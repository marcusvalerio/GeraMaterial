let ck=""; const B=process.argv[2];
const f=async(p,o={})=>{const r=await fetch(B+p,{...o,headers:{...(o.headers||{}),cookie:ck}});const sc=r.headers.get("set-cookie");if(sc)ck=sc.split(";")[0];return r;};
const json=(o)=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});
await f("/api/auth/entrar",json({email:"ux@teste.local",senha:"TesteUx2026!"}));
const s=await (await f("/api/sequencias/35")).json();
for (const [fmt,k] of [["per","per"],["planoaula","plano"],["pptx","slides:1"]]) {
  const r=await f("/api/exportar-pacote?nome=t",json({itens:[{formato:fmt,dados:s.resultados[k],nome:k}]}));
  console.log(fmt,r.status,r.status!==200?(await r.text()).slice(0,300):"");
}
