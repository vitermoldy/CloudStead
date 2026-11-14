// Link to the app's own server (npm run server). Everything here is optional: with
// the server off, or the site opened as static files, the app works exactly as
// before; events wait in the browser and go out once the server answers.
//
// A browser is known by a 12-character recovery code. The browser save is copied
// to the server under that code, so typing the code into another browser brings
// the same progress there.

const APP = 'cloudstead';
const ID_KEY = `${APP}:cloud-id`;
const OUTBOX_KEY = `${APP}:cloud-outbox`;
