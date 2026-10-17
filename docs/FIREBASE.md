# Firebase hosting setup

This repo does not deploy itself. CI typechecks, lints, tests, and builds. It does not call Firebase.

Hosting is configured to publish the Vite `dist` directory. `.firebaserc` points at a dedicated placeholder project, `structura-cad`. Do not point it back at the shared `rapid-prototyping-4134c` project. The old preview channel on that shared project is not this app's target.

## Steps for Conor

1. Install the Firebase CLI on your machine: `npm install -g firebase-tools`. Leave it out of this repo so CI does not need it.
2. In the Firebase console, create a project with the id `structura-cad`. If that id is already taken, create another **dedicated** project and change only the `default` value in `.firebaserc`. Do not reuse `rapid-prototyping-4134c`.
3. From a checkout of this repo, `firebase login`.
4. `npm install` and `npm run build`. That writes `dist`.
5. `firebase deploy --only hosting`.

There is intentionally no GitHub Actions deploy workflow yet. Add one only after the dedicated project exists and its credentials are stored as GitHub secrets, not in the repo.

Auth and a database are a later phase. See [ARCHITECTURE.md](./ARCHITECTURE.md).
