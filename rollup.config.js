import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import { terser } from "rollup-plugin-terser";
import json from "rollup-plugin-json";

// const iife = {
//     input: './index.js',
//     output: {
//         format: 'iife',
//         file: './lib/index.iife.min.js',
//         name: 'osmToOsmgo'
//     },
//     plugins: [
//         commonjs(),
//         resolve(),
//         babel(),
//         terser(),
//         json()
//     ]
// };

const cjs = {
  input: "./src/index.js",
  output: [
    {
      name: "edigeo-to-geojson",
      format: "cjs",
      file: "./lib/index.cjs",
      sourcemap: false
    },
    {
      name: "edigeo-to-geojson",
      format: "es",
      file: "./lib/index.mjs",
      sourcemap: false
    },
    {
      format: "iife",
      file: "./lib/index.iife.min.js",
      name: "osmToOsmgo"
    }
  ],
  plugins: [commonjs(), resolve({preferBuiltins: true}), babel(), 
    terser(),
     json()]
};

const conf = cjs;
// const conf = process.env.BABEL_ENV === 'cjs' ? cjs : iife;
export default conf;
