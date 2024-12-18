/*
website-watchdog - a telegram bot for website monitoring
Copyright (c) 2018 – 2019 Julian Eckhardt (www.eckhardt.io)

This program is free software; you can redistribute it and/or
modify it under the terms of version 2 of the GNU General Public License
as published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/
import axios from 'axios'; // License: MIT
import Promise from 'bluebird'; // License: MIT
import cheerio from 'cheerio'; // License: MIT
import CryptoJS from 'crypto-js'; // License: MIT
import moment from 'moment'; // License: MIT
import schedule from 'node-schedule'; // License: MIT
import normalizeUrl from 'normalize-url'; // License: MIT
import { open } from 'sqlite'; // License: MIT
import sqlite3 from 'sqlite3';
import { Telegraf, Telegram } from 'telegraf'; // License: MIT
import config from './config.json' with { type: 'json' };

const sha256 = CryptoJS.SHA256;

//
// CONFIG
// =============
const bot = new Telegraf(config.token);
const telegram = new Telegram(config.token);

//
// REPORT MODES
// =============

// full report
const REPORT_DEBUG = 0;
// only report errors, otherwise just send OK Message
const REPORT_INFO = 1;
// only report errors, otherwise stay silent
const REPORT_ERROR = 2;

//
// HELP DOCUMENT
// ===================
const help = `website-watchdog v1.0.2\n\n
Commands:\n
/scan -> perform full scan\n
/list -> list all watched sites\n
/register <url> -> add new site\n
/help -> this help document`;

//
// INIT SEQUENCE
// ===================
let db;
try {
	db = await open({
		filename: './database.sqlite',
		driver: sqlite3.Database,
	});
	await db.migrate();
	console.log('connected to database.sqlite');
	console.log('starting to poll for messages - startup sequence completed');
	bot.startPolling();
} catch (err) {
	console.error(err.stack);
	process.exit(1);
}

//
// HELPER FUNCTIONS
// ===================

async function listWatchedSites(ctx) {
	const sites = await db.all('SELECT * FROM target_sites');
	let message = 'Currently watched sites:\n\n';

	sites.forEach((site) => {
		message += `${site.site_url}\n`;
	});

	return message;
}

async function startService(ctx) {
	try {
		await checkAuth(ctx);
		db.run('INSERT OR REPLACE INTO users (id, first_name) VALUES ($id, $firstName)', {
			$id: ctx.chat.id,
			$firstName: ctx.chat.first_name,
		});
		const user = await db.get('SELECT * FROM users WHERE id = ?', ctx.chat.id);
		telegram.sendMessage(user.id, 'Hello 👋');
	} catch (err) {
		console.err(err.stack);
		ctx.reply(err.message);
	}
}

async function createReport(mode) {
	// prepare the message
	let message = '';
	let testPassed = true;

	// get sites from database
	// assuming small n here - might change to filter by user at some point
	const sites = await db.all('SELECT rowid, site_url, response_hash FROM target_sites');
	console.log(sites);

	if (sites.length !== 0) {
		const pMessageChunks = sites.map(async (site) => {
			let messageChunk = '';

			try {
				const { data } = await axios.get(site.site_url);
				console.log(`fetch successful for ${site.site_url}`);
				const $ = cheerio.load(data);
				// use combined text contents of whole page as content and hash it
				const responseHashNew = sha256($.text()).toString();

				if (responseHashNew !== site.response_hash) {
					messageChunk = `⚠️ ${site.site_url} (content changed)\n`;
					testPassed = false;

					await db
						.run('UPDATE target_sites SET response_hash = $response_hash WHERE rowid = $rowid', {
							$rowid: site.rowid,
							$response_hash: responseHashNew,
						})
						.catch((err) => console.log(err));
				} else if (mode === REPORT_DEBUG) {
					messageChunk = `✅ ${site.site_url}\n`;
				}
			} catch (err) {
				messageChunk = `❌ ${site.site_url} (HTTP Error)\n\n ${err.toString()}`;
				testPassed = false;
			}

			return messageChunk;
		});

		const messageChunks = await Promise.all(pMessageChunks);
		if (messageChunks) {
			messageChunks.forEach((chunk) => {
				message += chunk;
			});
		}

		if (testPassed && mode === REPORT_INFO) {
			message = `✅ ${moment().format('DD.MM.YY HH:mm zz')}\n`;
		}
		if ((!testPassed && mode === REPORT_ERROR) || mode === REPORT_DEBUG) {
			message += `\n\ntimestamp: ${moment().format('DD.MM.YY HH:mm zz')}\n`;
		}
	} else {
		message = 'no target sites found';
	}
	console.log(message);
	return message;
}

async function sendReports(mode) {
	const message = await createReport(mode);

	if (message !== '') {
		const users = await db.all('SELECT * FROM users;');

		if (users.length !== 0) {
			users.map(async (user) => {
				telegram.sendMessage(user.id, message).catch((err) => {
					console.log(err);
				});
			});
		}
	}
}

//
// COMMANDS
// =============

bot.start((ctx) => startService(ctx));
bot.help((ctx) => ctx.reply(help));

bot.command('scan', async (ctx) => {
	await checkAuth(ctx);
	try {
		console.log('SCAN command fired');
		const report = await createReport(REPORT_DEBUG);
		ctx.reply(report);
	} catch (err) {
		ctx.reply(err.message);
	}
});

bot.command('register', async (ctx) => {
	try {
		await checkAuth(ctx);
		// get message parts
		const messageEntities = ctx.message.entities;
		const messageText = ctx.message.text;

		// throw away the command entity
		messageEntities.splice(0, 1);

		messageEntities.forEach(async (entity) => {
			if (entity.type === 'url') {
				const url = normalizeUrl(messageText.substr(entity.offset, entity.length));
				const selectUrl = await db.get('SELECT * FROM target_sites WHERE site_url = ?', url);
				if (selectUrl) {
					ctx.reply(`target site ${url} is already registered`);
				} else {
					const response = await axios.get(url);
					const hash = sha256(response);

					await db.run('INSERT INTO target_sites (site_url, response_hash) VALUES ($url, $hash)', {
						$url: url,
						$hash: hash,
					});
					ctx.reply(`successfully registered ${url}`);
				}
			}
		});
	} catch (err) {
		ctx.reply(err.message);
	}
});

bot.command('list', async (ctx) => {
	try {
		await checkAuth(ctx);
		ctx.reply(await listWatchedSites());
	} catch (err) {
		ctx.reply(err.message);
	}
});

//
// SCHEDULES
// =============

// DAILY 04:30 (SYSTEM TIME UTC) BRIEFING
schedule.scheduleJob('0 30 4 * * *', async () => {
	await sendReports(REPORT_INFO);
});

// EVERY 20 MINUTE CHECK
schedule.scheduleJob('0 * * * * *', async () => {
	await sendReports(REPORT_ERROR);
});

async function checkAuth(ctx) {
	const user = await db.get('SELECT * FROM users WHERE id = ?', ctx.chat.id);
	if (!user) {
		throw new Error('You are not authorized');
	}
}
