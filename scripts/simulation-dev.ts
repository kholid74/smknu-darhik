import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {assertSimulationTarget} from '../src/lib/simulation-guard';
const config=parseEnv(readFileSync('.env.simulation','utf8'));
assertSimulationTarget(config.SIMULATION_DATABASE_URL,{...process.env,SMKDH_SIMULATION:config.SMKDH_SIMULATION});
const command=spawn(process.execPath,[resolve('node_modules/astro/bin/astro.mjs'),'dev','--background','--port','4322'],{env:{...process.env,...config},stdio:'inherit',windowsHide:true});
command.on('exit',code=>process.exitCode=code??1);
