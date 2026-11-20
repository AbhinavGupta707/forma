# Forma

Forma is a personal nutrition, fitness and workout tracker. Log meals and macros, save recipes, record strength and cardio sessions, and review how your nutrition and training change over time.

## Try the demo

Use Node.js 24 LTS.

```sh
npm ci
npm run demo
```

Open [http://localhost:3001](http://localhost:3001). **Today** shows sample meals and calorie totals. **Recipes** has two editable recipes. **Train** shows sample workouts and lets you start a session. **Trends** charts nutrition and body weight, while **Train → All analytics** shows training volume and progress by exercise.

## Start a fresh log

Stop the demo server and run `npm run dev` to open a fresh diary with a small starter food catalogue and a built-in exercise library. The starter food values are approximate. You can manually enter calories and macros, create foods while reviewing an AI log, or import the larger USDA FoodData Central catalogue by extracting the FNDDS, Foundation and SR Legacy CSV downloads into `data/usda/` and running `npm run import:usda`.

Forma stores records in local SQLite files. The fresh diary uses `data/forma.db`, and the fictional demo uses `data/demo.db`. The demo creates its sample records on the first run. The app binds to localhost by default and is designed for one person.

### Optional voice and text logging

Manual food and workout logging works without an account or API key. To enable natural-language parsing in the regular app, set `FORMA_FIREWORKS_API_KEY` to your own Fireworks API key in a local `.env.local` file and restart. AI logging sends the submitted text and relevant recipe or exercise names to Fireworks. The in-app microphone requires a browser that supports speech recognition. This integration is disabled in demo mode.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```
