Track users and share what's currently being played within your chat!

[![NPM](https://nodei.co/npm/hubot-lastfm-notifier.png?downloads=true&&downloadRank=true&stars=true)](https://nodei.co/npm/hubot-lastfm-notifier/)

This integration was built using the free API key from Last.fm. It uses Node Cron to check followed users recent tracks in regular intervals and post back what people are listening to in your chat. Shout out to Last.fm for supporting a free tier API capable of allowing us to do this. 

Some things to note, in recent years, more and more companies are closing up their open integrations and trying to keep users in a walled garden. To see how to scrobble from your favorite media sources, look here [Track My Music | Last.fm](https://www.last.fm/about/trackmymusic).

Have question, comment, or feature request? Reach out to me on Twitter [@kwandrews7](https://twitter.com/kwandrews7) or open up an issue here in the GitHub repo.

Example Interaction:

> Hubot >> 🎧 IsolatedSnail: Rehab - Bottles & Cans
> Hubot >> 🎧 IsolatedSnail: Usher - Burn

API
---

### Managing Followed Last.fm Users

Commands are case insensitive. Any changes to the list of followed users from a channel that is not the notification channel will be announced in the notification channel so all users are kept up to date of changes.

* `hubot show lastfm users` - List all users hubot is currently tracking on Last.fm.
* `hubot follow lastfm (username)` - Add new user to the list of currently tracked Last.fm profiles.
* `hubot forget lastfm (username)` - Remove a user from the list of currently tracked Last.fm profiles.

## Installation

Run the following command 

    $ npm install hubot-lastfm-notifier --save

To enable the script, add a `hubot-lastfm-notifier` entry to the `external-scripts.json`
file (you may need to create this file).

    ["hubot-lastfm-notifier"]

## Release Notes

### 1.0.1

* Only notifies on "now playing" to prevent bot from resending previous scrobbles when Last.fm's API is running behind and songs don't immediately show up in history after played.

### 1.0.0

* Initial release. 
* Includes adding, removing, and listing followed Last.fm users. 
* Notification channel and alerting channels can be configured separately.
* Supports custom cron schedule, defaults to once/minute.
