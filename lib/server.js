const {Server} = require('hapi');
const webhooksPlugin = require('hapi-github-webhooks');
const Joi = require('joi');

// This schema provides lots of contextual information for users
// and documentation can be generated from it.
const createServerSchema = Joi.object()
  .keys({
    path: Joi.string()
      .regex(/^\/[a-z/]*/i, 'route path')
      .default('/', 'root of server')
      .description('Web server path to which GitHub webhooks will post')
      .example('/webhook/'),
    secret: Joi.string()
      .required()
      .description('GitHub integration secret token')
      .example('my-super-secret-token-with-lots-of-entropy'),
    host: Joi.alternatives()
      .try(Joi.string()
        .hostname(), Joi.string()
        .ip())
      .default('127.0.0.1', 'local access only')
      .description('Hostname or IPv4/IPv6 address on which to bind the server'),
    port: Joi.number()
      .integer()
      .positive()
      .max(65535)
      .default(3000, 'default port')
      .description('TCP port on which to listen')
  })
  .description('Options for creating a Probot web server');

/**
 * Create a web server for Probot
 * @param {Object} [opts] - Options
 * @param {string} [opts.path] - Path of endpoint
 * @param {secret} [opts.secret] - Secret token
 * @param {host} [opts.host] - Host/interface on which to run server
 * @param {port} [opts.port] - Port on which to bind
 * @returns {Promise<Hapi.Server>} Server instance
 */
async function createServer(opts = {}) {
  const {error, value} = Joi.validate(opts, createServerSchema);
  if (error) {
    throw new Error(error);
  }
  const server = new Server();
  const {path, secret, host, port} = value;

  server.connection({
    host,
    port
  });

  return new Promise((resolve, reject) => {
    server.register([
      {
        register: require('hapi-github-webhooks'),
        options: {
          secret
        }
      },
      require('./github-webhook-handler')
    ], err => {
      if (err) {
        reject(err);
        return;
      }

      server.auth.strategy('githubwebhook', 'githubwebhook', {
        secret
      });

      server.route([
        {
          method: 'POST',
          path,
          handler: {
            webhook: {}
          }
        }
      ]);

      resolve(server);
    });
  });
};

module.exports = createServer;
