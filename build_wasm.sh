#/bin/bash

path=$PWD
build_dir="${PWD}/intersections/line"
out_dir="${PWD}/wasm"

echo $build_dir
echo $out_dir

wasm-pack build "${build_dir}" --out-dir "${out_dir}" --target web

