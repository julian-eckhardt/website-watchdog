const sqlite = require('sqlite');
const Telegraf = require('telegraf');
const Telegram = require('telegraf/telegram');
const Promise = require('bluebird');
const axios = require('axios');
const moment = require('moment')
const SHA256 = require('crypto-js/sha256');
const normalizeUrl = require('normalize-url');

// TODO: this can be deleted via npm…
const getUrls = require('get-urls');

const config = require('./config.json');

const bot = new Telegraf(config.token);
const telegram = new Telegram(config.token);

// full report
const REPORT_DEBUG = 0;
// only report errors, otherwise just send OK Message
const REPORT_INFO = 1;
// only report errors, otherwise stay silent
const REPORT_ERROR = 2;

bot.start((ctx) => startService(ctx));
bot.help((ctx) => ctx.reply("Sorry, no help document defined yet!")) // TODO: Create Help Reply

bot.command("scan", async function(ctx) {
	report = await createReport(REPORT_DEBUG);
	ctx.reply(report);
})

bot.command("register", async function(ctx) {
	// get message parts
	messageEntities = ctx.message.entities;
	messageText = ctx.message.text;

	// throw away the command entity
	messageEntities.splice(0,1); 

	messageEntities.forEach(async function(entity){
		if(entity.type === 'url'){
			url = normalizeUrl(messageText.substr(entity.offset, entity.length));
			const db = await dbPromise;
			if(await db.get('SELECT * FROM target_sites WHERE site_url = ?', url)){
				ctx.reply("target site " + url + " is already registered");
			}
			else{
				response = await axios.get(url);
				hash = SHA256(response);

				db.run('INSERT INTO target_sites (site_url, response_hash) VALUES ($url, $hash)', {$url: url, $hash: hash})
					.catch((err) => ctx.reply("could not persist new target site " + url + ": \n" + err))
					.then(ctx.reply("successfully registered " + url));
			}
		}
	})
});

listWatchedSites = async function(){
	const db = await dbPromise;
	const sites = db.get('SELECT site_url FROM target_sites');
	message = "Currently watched sites:\n\n"

	sites.forEach(site => {
		message += (site.site_url + "\n");
	});

	return messages;
}
/*
registerNewPage = function (ctx) {
	newPage = ctx.message.substring(8);
	
}
*/
startService = async function (ctx) {
	const db = await dbPromise;
	try{
		db.run('INSERT OR REPLACE INTO users (id, first_name) VALUES ($id, $firstName)', {$id: ctx.chat.id, $firstName: ctx.chat.first_name})
	}
	catch (err){
		console.err(err.stack);
	}
	const user = await db.get('SELECT * FROM users WHERE id = ?', ctx.chat.id)
	telegram.sendMessage(user.id, "Hello 👋")
}

createReport = async function(mode) {
	// prepare the message
	message = "";
	testPassed = true;

	// get sites from database
	// assuming small n here - might change to filter by user at some point
	const db = await dbPromise;
	sites = await db.all('SELECT rowid, site_url, response_hash FROM target_sites');

	if(sites.length !== 0){
		const pMessageChunks = sites.map(async function (site) {
			messageChunk = "";
			response = await axios.get(site.site_url)
				.catch((err) => {
					messageChunk = ("❌ " + site.site_url + " (HTTP Error)\n");
					testPassed = false;
				});
			response_hash_new = SHA256(response).toString();

			if (response_hash_new !== site.response_hash) {
				messageChunk = ("⚠️ " + site.site_url + " (content changed)\n");
				testPassed = false;

				await db.run('UPDATE target_sites SET response_hash = $response_hash WHERE rowid = $rowid', {$rowid: site.rowid, $response_hash: response_hash_new})
					.catch(err => console.log(err));
			}
			else if (mode === REPORT_DEBUG) {
				messageChunk = ("✅ " + site.site_url + "\n");
			}
			return messageChunk;
		});

		const messageChunks = await Promise.all(pMessageChunks);
		if(messageChunks){
			messageChunks.forEach(chunk => message += chunk);
		}

		if (testPassed && mode === REPORT_INFO) {
			message = "✅ " + moment().format('DD.MM.YY HH:mm zz') + '\n';
		}
		if (mode === REPORT_ERROR || mode === REPORT_DEBUG) {
			message += "\n\ntimestamp: " + moment().format('DD.MM.YY HH:mm zz') + '\n';
		}
	}
	else {
		message = "no target sites found";
	}
	return message;
}

sendDailyReport = async function() {
	const users = await db.all('SELECT * FROM users');
	users.forEach(user => async function() {
		telegram.sendMessage(user.id, await createReport(REPORT_ERROR));
	});
}

const dbPromise = Promise.resolve()
	.then(() => sqlite.open('./database.sqlite', { Promise }))
	// PICK YOUR DESIRED MIGRATION
	// ===========================
	.then(db => db.migrate())
	//.then(db => db.migrate({ force: 'last' }))
	// ===========================
	.catch((err) => console.error(err.stack))
	.then(console.log("connected to database.sqlite"))
	.then(console.log("starting to poll for messages - startup squence completed"))
	.finally(() => bot.startPolling());