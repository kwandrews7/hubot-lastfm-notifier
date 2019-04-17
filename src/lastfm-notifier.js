// Description:
//   Hubot script to share Last.fm scrobbles for followed users in near real time. Requires a last.fm API key.
//
// Dependencies:
//   cron: ^1.7.0
//   lodash: ^4.17.11
//
// Commands:
//   hubot show lastfm users - Lists all users currently being followed.
//   hubot follow lastfm (username) - Starts following a new user.
//   hubot forget lastfm (username) - Stops following a user.
//
// Configuration:
//   LASTFM_API_KEY (required) - Last.fm API Key required for all requests to go through.
//   LASTFM_NOTIFY_CHANNEL (required) - Channel ID where songs should be shared.
//   LASTFM_ERROR_CHANNEL (optional) - Channel ID where any error messages or alerts should be posted, such as rate limit exhausted or server 500 responses.
//   LASTFM_CRON_SCHEDULE (optional) - Node CronJob configuration for querying Last.fm for new scrobbles. Defaults to '30 * * * * *' to check every minute on the 30 second mark. If you are following a significant numbers of users, you may need to check in larger intervals to prevent rate limiting.
// 
// Author: 
//   kwandrews7
//

const _ = require('lodash');
const CronJob = require('cron').CronJob;

const cronSchedule = process.env.LASTFM_CRON_SCHEDULE || '30 * * * * *';
const apiKey = process.env.LASTFM_API_KEY;
const timezone = process.env.TZ || 'America/Chicago';
const notificationChannelId = process.env.LASTFM_NOTIFY_CHANNEL;
const errorChannelId = process.env.LASTFM_ERROR_CHANNEL;

module.exports = function (robot) {

  if (!apiKey) {
    robot.logger.error('LastFm-Notifier: LASTFM_API_KEY environment variable missing! Last.fm Notifier will not function until this is corrected!');
    return;
  }

  if (!notificationChannelId) {
    robot.logger.error('LastFm-Notifier: LASTFM_NOTIFY_CHANNEL environment variable missing! Last.fm Notifier will not function until this is corrected!');
    return;
  }

  if (!notificationChannelId) {
    robot.logger.warn('LastFm-Notifier: LASTFM_ERROR_CHANNEL environment variable missing! Last.fm Notifier will not post errors to the chat. Errors will continue to be logged via [robot.logger.error].');
    return;
  }

  if (!robot.brain.data.stock_checker_holdings) {
    robot.brain.data.last_fm_notifier_users = {};
  }

  new CronJob(cronSchedule, function () {
    robot.logger.info('LastFm-Notifier: Checking for new Last.fm scrobbles via Node-Cron.');
    runChecksForAllUsers(robot);
  }, null, true, timezone);

  robot.respond(/follow lastfm (\w*\.?\w*)$/i, function (message) {
    let username = message.match[1];
    let url = `http://ws.audioscrobbler.com/2.0/?api_key=${process.env.LASTFM_API_KEY}&format=json&method=user.getrecenttracks&user=${username}`;
    robot.http(url).header('Content-Type', 'application/json').get()(function (err, res, body) {
      if (res.statusCode === 404) {
        message.send(`${username} could not be found on Last.fm! Verify the username exists and has successfully scrobbled at least once. Then try again.`);
      } else {
        robot.brain.data.last_fm_notifier_users[username] = {};
        message.send(`${username} is now being followed. I'll report back any new Scrobbles ASAP!`);
        listFollowedUsers(robot, message);

        if (message.message.room !== notificationChannelId) {
          let requester = message.message.user.name;
          robot.messageRoom(notificationChannelId, `${requester} has added ${username} to the Last.fm Notifier.`);
        } else {
          robot.logger.debug('LastFm-Notifier: No need to announce changes. They occurred publicly within the notification channel.');
        }
      }
    });
  });

  robot.respond(/forget lastfm (\w*\.?\w*)$/i, function (message) {
    let username = message.match[1];
    delete robot.brain.data.last_fm_notifier_users[username];
    message.send(`Who? Never heard of them.`);
    listFollowedUsers(robot, message);

    if (message.message.room !== notificationChannelId) {
      let requester = message.message.user.name;
      robot.messageRoom(notificationChannelId, `${requester} has removed ${username} from the Last.fm Notifier.`);
    } else {
      robot.logger.debug('LastFm-Notifier: No need to announce changes. They occurred publicly within the notification channel.');
    }
  });

  robot.respond(/show lastfm users/i, function (message) {
    listFollowedUsers(robot, message);
  });

};

function listFollowedUsers(robot, message) {
  let users = Object.keys(robot.brain.data.last_fm_notifier_users).map(user => `${user}\n`);
  message.send(`I'm currently watching the following users:\n${users.join('')}`);
}

function runChecksForAllUsers(robot) {
  Object.keys(robot.brain.data.last_fm_notifier_users).forEach(function (key, index) {
    checkUserForNewActivity(robot, key);
  });
}

function checkUserForNewActivity(robot, user) {
  let url = `http://ws.audioscrobbler.com/2.0/?api_key=${process.env.LASTFM_API_KEY}&format=json&method=user.getrecenttracks&user=${user}`;
  robot.http(url)
    .header('Content-Type', 'application/json')
    .get()(function (err, res, body) {
      if (res.statusCode === 429) {
        // Tell bot-spam that we've hit a rate limit.
        robot.logger.warn(`LastFm-Notifier: Last.fm notifier <${user}> has overstepped the API rate limit. Consider reducing the timing on stream checks.`);
        robot.messageRoom(errorChannelId, `Last.fm notifier <${user}> has overstepped the API rate limit. Consider reducing the timing on stream checks.`);
        return;
      }
      if (res.statusCode >= 400) {
        // Tell bot-spam that we've hit a rate limit.
        robot.messageRoom(errorChannelId, `Last.fm notifier <${user}> failing with statusCode [${res.statusCode}]. Haalp!`);
        return;
      }

      robot.logger.info(`LastFm-Notifier <${user}>: Successfully retrieved data from Last.fm API.`);
      let json = JSON.parse(body);
      robot.logger.info(`LastFm-Notifier <${user}>: Successfully parsed Last.fm API response.`);
      let track = json.recenttracks.track[0];
      if (track) {
        robot.logger.debug(`LastFm-Notifier <${user}>: Request completed successfully.`);
        let songId = songIdentifier(track);
        if (robot.brain.data.last_fm_notifier_users[user] && robot.brain.data.last_fm_notifier_users[user] === songId) {
          robot.logger.info(`LastFm-Notifier <${user}>: No change. <${songId}> This is the same song we saw last time.`);
        } else if (!robot.brain.data.last_fm_notifier_users[user]) {
          robot.logger.info(`LastFm-Notifier <${user}>: No lastSong found for user. Saving this one <${songId}> and skipping. We don\'t want to send duplicates.`);
          robot.brain.data.last_fm_notifier_users[user] = songId;
        } else {
          robot.brain.data.last_fm_notifier_users[user] = songId;
          robot.logger.info(`LastFm-Notificer <${user}>: New song found! <${songId}> I'll share with the masses right now!`);
          robot.messageRoom(notificationChannelId, `🎧 ${user}: ${getTrackArtist(track)} - ${getTrackName(track)}`);
        }
      } else {
        robot.logger.info('LastFm-Notifier <${user}>: Nobody is scrobbling right now. :( Maybe later.');
      }
    });
}

function getTrackArtist(track) {
  return _.get(track, ['artist', '#text'], '<Unknown Artist>');
}

function getTrackAlbum(track) {
  return _.get(track, ['album', '#text'], '<Unknown Album>');
}

function getTrackName(track) {
  return _.get(track, ['name'], '<Untitled Track>');
}

function songIdentifier(track) {
  let artist = getTrackArtist(track);
  let album = getTrackAlbum(track);
  let song = getTrackName(track);
  return `${artist}+${album}+${song}`;
}
