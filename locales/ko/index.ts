import { api } from "./api";
import { characters } from "./characters";
import { common } from "./common";
import { contribute } from "./contribute";
import { game } from "./game";
import { guilds } from "./guilds";
import { home } from "./home";
import { rankings } from "./rankings";
import { seo } from "./seo";
import { stats } from "./stats";
import { submissions } from "./submissions";
import { submit } from "./submit";
import { admin } from "./admin";

export const ko = { common, game, rankings, characters, guilds, home, stats, api, seo, submissions, submit, admin, contribute };
export type Messages = typeof ko;
