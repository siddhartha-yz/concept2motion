export const safeHref=value=>/^(https?:|mailto:|#)/i.test(String(value))?value:undefined;
export function sanitize(n,stats){
  if(n.type==='element'){
    if(n.tagName==='img'){
      stats.imagesSuppressed++;
      n.tagName='span';n.children=[{type:'text',value:`[原教材图片：${n.properties?.alt??'无替代文字'}；本地导入未自动下载]`}];n.properties={className:['image-placeholder']};
    }
    for(const key of Object.keys(n.properties??{}))if(/^on/i.test(key))delete n.properties[key];
    if(n.tagName==='a'){
      const href=safeHref(n.properties.href);
      if(!href)delete n.properties.href;else n.properties.href=href;
      n.properties.rel=['noopener','noreferrer'];
    }
    if((n.properties?.className??[]).includes('katex-error'))stats.katexErrors++;
  }
  for(const child of n.children??[])sanitize(child,stats);
}
