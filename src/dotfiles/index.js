
/**
 * @imports
 */
import Fs from 'fs';
import * as DotEnv from './DotEnv.js';
import * as DotJs from './DotJs.js';
import * as DotJson from './DotJson.js';
import { _unique } from '@webqit/util/arr/index.js';

/**
 * @exports
 */
export {
    DotEnv,
    DotJs,
    DotJson,
}

/**
 * @anyExists
 */
export function anyExists(files, nameCallback = null) {
    return _unique(files).reduce((prev, file) => prev || (Fs.existsSync(nameCallback ? nameCallback(file) : file) ? file : false), false);
}