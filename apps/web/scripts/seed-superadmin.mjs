/**
 * Super Admin hesabı oluşturma script'i
 * Kullanım: node scripts/seed-superadmin.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik!');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EMAIL = 'admin@stundly.de';
const PASSWORD = 'Admin123!';
const FULL_NAME = 'Super Admin';

async function main() {
  console.log('🔧 Super Admin hesabı oluşturuluyor...');
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Şifre: ${PASSWORD}`);
  console.log('');

  // 1. Mevcut kullanıcıyı kontrol et
  const { data: existingProfiles } = await admin
    .from('profiles')
    .select('user_id, email, role')
    .eq('role', 'super_admin');

  if (existingProfiles && existingProfiles.length > 0) {
    console.log('✅ Zaten mevcut super_admin hesapları:');
    existingProfiles.forEach(p => {
      console.log(`   → ${p.email ?? 'email yok'} (user_id: ${p.user_id})`);
    });
    
    // Rolü güncelleme gerekebilir mi diye kontrol et
    const { data: emailProfile } = await admin
      .from('profiles')
      .select('user_id, email, role')
      .eq('email', EMAIL)
      .single();

    if (emailProfile) {
      if (emailProfile.role === 'super_admin') {
        console.log(`\n✅ ${EMAIL} zaten super_admin. Şifreyi sıfırlamayı deniyorum...`);
        // Şifre sıfırla
        const { error: resetErr } = await admin.auth.admin.updateUserById(emailProfile.user_id, {
          password: PASSWORD,
        });
        if (resetErr) {
          console.error('❌ Şifre sıfırlama hatası:', resetErr.message);
        } else {
          console.log(`✅ Şifre güncellendi → ${PASSWORD}`);
        }
      } else {
        console.log(`\n⚠️ ${EMAIL} mevcut ama rolü: ${emailProfile.role}. Super admin yapılıyor...`);
        await admin.from('profiles').update({ role: 'super_admin' }).eq('user_id', emailProfile.user_id);
        
        // Şifre sıfırla
        const { error: resetErr } = await admin.auth.admin.updateUserById(emailProfile.user_id, {
          password: PASSWORD,
        });
        if (!resetErr) {
          console.log(`✅ Rol güncellendi ve şifre sıfırlandı → ${PASSWORD}`);
        }
      }
      return;
    }
    
    console.log('\nMevcut super admin var, yeni bir tane de oluşturuyorum...');
  }

  // 2. Yeni auth kullanıcısı oluştur
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });

  if (authErr) {
    if (authErr.message?.includes('already been registered') || authErr.message?.includes('already exists')) {
      console.log('⚠️ Auth kullanıcısı zaten var. Profile rolünü güncelliyorum...');
      
      // Auth user'ı bul
      const { data: { users } } = await admin.auth.admin.listUsers();
      const existing = users?.find(u => u.email === EMAIL);
      
      if (existing) {
        // Şifre sıfırla
        await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
        
        // Profile rolünü güncelle
        const { error: profileErr } = await admin.from('profiles').update({
          role: 'super_admin',
          full_name: FULL_NAME,
        }).eq('user_id', existing.id);
        
        if (profileErr) {
          // Profile yoksa oluştur
          await admin.from('profiles').upsert({
            user_id: existing.id,
            email: EMAIL,
            full_name: FULL_NAME,
            role: 'super_admin',
            is_active: true,
            plan: 'individual',
          }, { onConflict: 'user_id' });
        }
        
        console.log(`✅ Mevcut hesap güncellendi:`);
        console.log(`   Email: ${EMAIL}`);
        console.log(`   Şifre: ${PASSWORD}`);
        console.log(`   Rol: super_admin`);
      }
      return;
    }
    console.error('❌ Auth hatası:', authErr.message);
    return;
  }

  if (!created?.user) {
    console.error('❌ Kullanıcı oluşturulamadı');
    return;
  }

  const userId = created.user.id;
  console.log(`✅ Auth user oluşturuldu: ${userId}`);

  // 3. Profile oluştur/güncelle
  const { error: profileErr } = await admin.from('profiles').upsert({
    user_id: userId,
    email: EMAIL,
    full_name: FULL_NAME,
    role: 'super_admin',
    is_active: true,
    plan: 'individual',
  }, { onConflict: 'user_id' });

  if (profileErr) {
    console.error('❌ Profile hatası:', profileErr.message);
    // Trigger'ın oluşturmasını bekle, sonra güncelle
    await new Promise(r => setTimeout(r, 1000));
    await admin.from('profiles').update({
      role: 'super_admin',
      full_name: FULL_NAME,
    }).eq('user_id', userId);
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ SUPER ADMIN HESABI HAZIR');
  console.log('═══════════════════════════════════════');
  console.log(`   Email:  ${EMAIL}`);
  console.log(`   Şifre:  ${PASSWORD}`);
  console.log(`   Panel:  /superadmin`);
  console.log('═══════════════════════════════════════');
}

main().catch(console.error);
