For a fresh checkout, copy `config.example.js` to `config.js` before serving the frontend.

Set the backend address in `config.js`. All API requests, uploaded image URLs, and chat WebSocket connections use this setting. Trailing slashes are removed automatically.

`config.js` is local configuration and is ignored by Git. `config.example.js` is only the setup template; the application does not load it.
