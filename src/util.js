

/**
 * @imports
 */
import { _isObject, _isArray } from '@webqit/util/js/index.js';

export function merge(a, b, arrFn = 0, keys = []) {
    let result = arguments.length > 3 ? [] : {};
    (arguments.length > 3 ? keys : Object.keys(a).concat(Object.keys(b))).forEach(k => {
        if (_isObject(a[k]) && _isObject(b[k])) {
            result[k] = merge(a[k], b[k], arrFn);
        } else if (_isArray(a[k]) && _isArray(b[k]) && arrFn) {
            if (arrFn === 'merge') {
                result[k] = a[k].concat(b[k]);
            } else if (arrFn === 'patch') {
                let longer = a[k].length > b[k].length ? a[k] : b[k];
                result[k] = merge(a[k], b[k], arrFn, Object.keys(longer).map(k => parseInt(k)));
            }
        } else {
            result[k] = k in b ? b[k] : a[k];
        }
    });
    return result;
}
