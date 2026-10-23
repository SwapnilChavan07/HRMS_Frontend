# HRMS Employee Portal

Angular frontend for the HRMS employee portal, built with Angular CLI 21.

## Development server

Start the HRMS API with its `https` launch profile, then start Angular:

```bash
npm start
```

Open `http://localhost:4200/`. The development proxy forwards `/api` requests to `https://localhost:7299` (the API's local HTTPS launch URL). Trust the local .NET development certificate if needed. The API's `Cors:AllowedOrigins` must include `http://localhost:4200`.

## Sign-in flow

- `/login` sends `{ usernameOrEmail, password }` to `POST /api/Auth/login`.
- On success, the app navigates to `/mfa` and presents the two verification options.
- Authenticator setup calls `POST /api/Auth/authenticator/setup`. The returned enrollment details are displayed for setup.
- Registered Email OTP sends `{ usernameOrEmail, otp }` to `POST /api/Auth/verifyotp`.
- API requests use the same-origin `/api` path locally, proxied to `https://localhost:7299`. Configure a proxy to the deployed API origin for production.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
