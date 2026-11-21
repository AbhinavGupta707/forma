import { z } from "zod";
import { getDb } from "@/lib/db";
import { computeTargets } from "@/lib/goals";
import { getPrefs, getProfile, prefsSchema, profileSchema, savePrefs, saveProfile } from "@/lib/settings";
import { handle, ok, parseBody } from "@/lib/api";

function current() {
  const db = getDb();
  const profile = getProfile(db);
  return { profile, prefs: getPrefs(db), targets: computeTargets(profile) };
}

export const GET = handle(() => ok(current()));

export const PUT = handle(async (req: Request) => {
  const body = await parseBody(req, z.object({ profile: profileSchema, prefs: prefsSchema }));
  const db = getDb();
  db.transaction(() => {
    saveProfile(db, body.profile);
    savePrefs(db, body.prefs);
  })();
  return ok(current());
});
