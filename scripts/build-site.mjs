import {mkdir,rm,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('_site/',root);
await rm(out,{recursive:true,force:true});await mkdir(new URL('data/',out),{recursive:true});
for(const file of ['index.html','.nojekyll'])await copyFile(new URL(file,root),new URL(file,out));
await copyFile(new URL('data/stations.json',root),new URL('data/stations.json',out));
await cp(new URL('assets/',root),new URL('assets/',out),{recursive:true});
console.log('Prepared public static assets and station roster only');
