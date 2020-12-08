
/**
 * @imports
 */
import _arrLast from '@webqit/util/arr/last.js';
import _arrFrom from '@webqit/util/arr/from.js';

/**
 * Parses command-line args to a more-usable format
 * 
 * @param array args
 * 
 * @return object
 */
export default function(argv) {
    var command = argv[2], args = argv.slice(3), keywords = {}, flags = {}, options = {}, ellipsis;
    if (_arrLast(args) === '...') {
        args.pop();
        ellipsis = true;
    }
    args.forEach(arg => {
        if (arg.indexOf('+=') > -1 || arg.indexOf('=') > -1 || arg.startsWith('#')) {
            if (arg.indexOf('+=') > -1) {
                arg = arg.split('+=');
                var arg_name = arg[0];
                options[arg_name] = _arrFrom(options[arg_name]);
                options[arg_name].push(arg[1]);
            } else {
                arg = arg.split('=');
                var arg_name = arg[0];
                options[arg_name] = arg[1] === 'TRUE' ? true : (arg[1] === 'FALSE' ? false : arg[1]);
            }
        } else if (arg.startsWith('--')) {
            flags[arg.substr(2)] = true;
        } else {
            keywords[arg] = true;
        }
    });
    return {
        command,
        keywords,
        flags,
        options,
        ellipsis,
    }
};