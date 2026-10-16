// Consulta pública de versão. O progresso em IndexedDB nunca é substituído aqui.
(async()=>{
  const status=document.querySelector('#update-status');
  const retry=document.querySelector('#retry-update');
  retry.onclick=()=>location.reload();
  try{
    const response=await fetch(`./version.json?check=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Versão indisponível.');
    const version=await response.json();
    if(version.format!==1||typeof version.release!=='string'||!/^[a-f0-9]{16}$/.test(version.release))throw new Error('Versão inválida.');
    let previous;
    try{previous=localStorage.getItem('bruna-estuda-release');}catch{}
    const changed=Boolean(previous&&previous!==version.release);
    status.textContent=changed?'Atualizando seu espaço…':'Preparando seu espaço…';
    const suffix=`?v=${version.release}`;
    await new Promise((resolve,reject)=>{
      const style=document.querySelector('#app-styles');
      style.onload=resolve;style.onerror=()=>reject(new Error('Estilos indisponíveis.'));
      style.href=`./styles.css${suffix}`;
    });
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.type='module';script.src=`./app.mjs${suffix}`;
      script.onload=resolve;script.onerror=()=>reject(new Error('Aplicação indisponível.'));
      document.head.append(script);
    });
    try{localStorage.setItem('bruna-estuda-release',version.release);}catch{}
    document.querySelector('#pin-form [type="submit"]').disabled=false;
    status.textContent=changed?'Atualizado. Pode entrar.':'Tudo pronto para estudar.';
  }catch{
    status.textContent='Não foi possível verificar a atualização. Confira a conexão e tente novamente.';
    retry.hidden=false;
  }
})();
