import { createServiceClient } from '../src/lib/supabase/service';
const s = await createServiceClient();
if (!s) { console.log('sin service client'); process.exit(1); }
for (const cod of ['1111', '2222']) {
  const { data, error } = await s.rpc('rr_hub_equipo_del_cliente', { p_codigo: cod });
  console.log(cod, '-> error:', error?.message ?? 'ninguno', '| tipo:', Array.isArray(data) ? 'array' : typeof data, '| largo:', Array.isArray(data) ? data.length : 'n/a');
  if (Array.isArray(data)) console.log('   muestra:', JSON.stringify(data[0]));
  const c = await s.rpc('rr_hub_cliente_por_codigo', { p_codigo: cod });
  console.log('   cliente:', JSON.stringify(c.data), '| error:', c.error?.message ?? 'ninguno');
}
