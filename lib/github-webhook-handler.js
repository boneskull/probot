const {EventEmitter} = require('events');

function githubWebhookHandler(server, opts = {}, next) {
  const webhook = new EventEmitter();

  function routeHandler () {
    return (req, reply) => {
      const data = {
        event: req.headers['x-github-event'],
        id: req.headers['x-github-delivery'],
        payload: req.payload,
        protocol: req.raw.protocol,
        host: req.info.host,
        url: req.url
      };

      reply({ok: true});

      webhook.emit(event, data);
      webhook.emit('*', data);
    };
  }

  routeHandler.defaults = {
    auth: {
      strategies: ['githubwebhook'],
      payload: 'required'
    }
  }

  server.app.webhook = webhook;

  server.handler('webhook', routeHandler);

  next();
};

githubWebhookHandler.attributes = {
  dependencies: ['hapi-github-webhooks'],
  name: 'github-webhook-handler'
};

exports.register = githubWebhookHandler;
