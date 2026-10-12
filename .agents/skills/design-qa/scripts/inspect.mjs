#!/usr/bin/env node
import { cli } from './web.mjs';
process.exitCode = await cli(true);
