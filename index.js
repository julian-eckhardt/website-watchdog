const sqlite = require('sqlite');
const telegraf = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply("Welcome to the Website Watchdog!\n\nI am currently watching:" + listWatchedPages()));
bot.help((ctx) => ctx.reply("Sorry, no help document defined yet!")) // TODO: Create Help Reply
// bot.hears("list", (ctx) => ctx.reply(listStatus) // TODO: Implement
bot.hears("register ", (ctx) => ctx.reply(registerNewPage(ctx)));

listWatchedPages = function(){
	pages = ["page1", "page2", "page3"];
	outputStr = ""
	pages.forEach(page => {
		outputStr += ("\n- " + page);
	});
}

registerNewPage = function (ctx) {
	newPage = ctx.message.substring(8);
	
}