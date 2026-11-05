'use strict';
/*
 * TS/TSX 语法校验。
 * 不跑 tsc（要装整套 RN 类型，太重），只用 babel 解析器确认：
 *   1) 语法合法
 *   2) 括号/JSX 标签闭合
 *   3) 顶层 import 的模块路径能对上实际文件（抓笔误）
 * 类型错误交给 CI 的 tsc（可选），这里只保证不会因为语法问题整包编不过。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', 'overlay');
const files = [];

function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) files.push(p);
    }
}
walk(SRC);

let bad = 0;
const imported = [];

for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    const rel = path.relative(SRC, f);
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: false,
        });
        // 收集相对导入，后面校验文件存在
        for (const node of ast.program.body) {
            if (node.type === 'ImportDeclaration' && String(node.source.value).startsWith('.')) {
                imported.push({ from: rel, to: node.source.value });
            }
        }
        console.log('  ok   ' + rel);
    } catch (e) {
        bad++;
        console.error('  FAIL ' + rel + '  →  ' + e.message);
    }
}

console.log('\n语法检查：' + (files.length - bad) + '/' + files.length + ' 通过');

console.log('\n相对导入解析：');
let miss = 0;
for (const im of imported) {
    const base = path.resolve(path.dirname(path.join(SRC, im.from)), im.to);
    const cands = [base, base + '.ts', base + '.tsx', base + '.js', path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
    const hit = cands.some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!hit) {
        miss++;
        console.error('  MISS ' + im.from + "  →  '" + im.to + "'");
    }
}
console.log(miss === 0 ? '  全部命中' : '  ' + miss + ' 个未命中');

process.exitCode = bad + miss > 0 ? 1 : 0;
