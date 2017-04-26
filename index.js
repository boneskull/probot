const bunyan = require('bunyan');
const bunyanFormat = require('bunyan-format');
const sentryStream = require('bunyan-sentry-stream');
const cacheManager = require('cache-manager');
const createIntegration = require('github-integration');
const createWebhook = require('github-webhook-handler');
const Raven = require('raven');

const createRobot = require('./lib/robot');
const createServer = require('./lib/server');

module.exports = async options => {
  const cache = cacheManager.caching({
    store: 'memory',
    ttl: 60 * 60 // 1 hour
  });

  const logger = bunyan.createLogger({
    name: 'PRobot',
    level: process.env.LOG_LEVEL || 'debug',
    stream: bunyanFormat({outputMode: process.env.LOG_FORMAT || 'short'})
  });

  const integration = createIntegration({
    id: options.id,
    cert: options.cert,
    debug: process.env.LOG_LEVEL === 'trace'
  });

  let server;
  try {
    server = await createServer({
      port: options.port,
      host: options.host,
      secret: process.env.WEBHOOK_SECRET
    });
  } catch (err) {
    throw err;
  }

  const {webhook} = server.app;
  const robot = createRobot({integration, webhook, cache, logger});

  if (process.env.SENTRY_URL) {
    Raven.disableConsoleAlerts();
    Raven.config(process.env.SENTRY_URL, {
      captureUnhandledRejections: true,
      autoBreadcrumbs: true
    }).install({});

    logger.addStream(sentryStream(Raven));
  }

  // Handle case when webhook creation fails
  webhook.on('error', err => {
    logger.error(err);
  });

  return {
    server,
    robot,

    start() {
      return new Promise((resolve, reject) => {
        server.start(err => {
          if (err) {
            reject(err);
            return;
          }
          logger.trace('Listening on http://localhost:' + options.port);
          resolve()
        });
      });
    },

    load(plugin) {
      plugin(robot);
    }
  };
};
