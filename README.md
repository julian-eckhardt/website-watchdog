# website-watchdog
A telegram bot for website monitoring

This bot scans previously added websites in regular intervals and sends
telegram messages to subscribed users when website content could not be
retrieved or the website content has changed since the last scan was
performed.

In addition, the bot once a day sends a status message to subscribed
users to give confirmation that it is still running and able to send messages.

## How to install
- run `npm install`
- add your telegram bot key to `config.json`
- configure cron-style tasks in `index.js` to fit your needs

## How to run
- run `npm start` 

## Bot commands
- `\start`: subscribe
- `\register <url>`: start watching `<url>` 
- `\list`: list watched sites
- `\scan`: invoke scan and return full report of all watched sites
- `\help`: display help document