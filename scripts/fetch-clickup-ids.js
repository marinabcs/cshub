/**
 * Script para buscar IDs do ClickUp
 * Execute com: node scripts/fetch-clickup-ids.js
 */

const CLICKUP_API_KEY = 'pk_43150128_J7V5F0JC0VC3QQS1TJP2D53F5Q7TFKBE';
const BASE_URL = 'https://api.clickup.com/api/v2';

async function fetchClickUp(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': CLICKUP_API_KEY
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  console.log('🔍 Buscando IDs do ClickUp...\n');

  const results = {
    team_id: null,
    space_id: null,
    folder_id: null,
    list_id: null,
    custom_fields: []
  };

  // 1. Buscar Workspaces/Teams
  console.log('1️⃣ Buscando workspaces...');
  const teamsData = await fetchClickUp('/team');
  console.log('   Teams encontrados:', teamsData.teams?.length || 0);

  if (teamsData.teams && teamsData.teams.length > 0) {
    const team = teamsData.teams[0];
    results.team_id = team.id;
    console.log(`   ✅ team_id: ${team.id} (${team.name})\n`);

    // 2. Buscar Spaces do workspace
    console.log('2️⃣ Buscando spaces...');
    const spacesData = await fetchClickUp(`/team/${team.id}/space`);
    console.log('   Spaces encontrados:', spacesData.spaces?.length || 0);

    if (spacesData.spaces) {
      for (const space of spacesData.spaces) {
        console.log(`   - ${space.name} (id: ${space.id})`);
      }

      // Usar o primeiro space ou procurar um específico
      const space = spacesData.spaces[0];
      results.space_id = space.id;
      console.log(`   ✅ space_id: ${space.id} (${space.name})\n`);

      // 3. Buscar Folders do space
      console.log('3️⃣ Buscando folders...');
      const foldersData = await fetchClickUp(`/space/${space.id}/folder`);
      console.log('   Folders encontradas:', foldersData.folders?.length || 0);

      if (foldersData.folders) {
        for (const folder of foldersData.folders) {
          console.log(`   - ${folder.name} (id: ${folder.id})`);
        }

        // Procurar folder "Atendimento"
        const atendimentoFolder = foldersData.folders.find(f =>
          f.name.toLowerCase().includes('atendimento')
        ) || foldersData.folders[0];

        if (atendimentoFolder) {
          results.folder_id = atendimentoFolder.id;
          console.log(`   ✅ folder_id (Atendimento): ${atendimentoFolder.id} (${atendimentoFolder.name})\n`);

          // 4. Buscar Lists da folder
          console.log('4️⃣ Buscando lists...');
          const listsData = await fetchClickUp(`/folder/${atendimentoFolder.id}/list`);
          console.log('   Lists encontradas:', listsData.lists?.length || 0);

          if (listsData.lists) {
            for (const list of listsData.lists) {
              console.log(`   - ${list.name} (id: ${list.id})`);
            }

            // Procurar list "Atividades"
            const atividadesList = listsData.lists.find(l =>
              l.name.toLowerCase().includes('atividades') || l.name.toLowerCase().includes('atividade')
            ) || listsData.lists[0];

            if (atividadesList) {
              results.list_id = atividadesList.id;
              console.log(`   ✅ list_id (Atividades): ${atividadesList.id} (${atividadesList.name})\n`);

              // 5. Buscar Custom Fields da list
              console.log('5️⃣ Buscando campos customizados...');
              const fieldsData = await fetchClickUp(`/list/${atividadesList.id}/field`);
              console.log('   Campos encontrados:', fieldsData.fields?.length || 0);

              if (fieldsData.fields) {
                results.custom_fields = fieldsData.fields.map(f => ({
                  id: f.id,
                  name: f.name,
                  type: f.type
                }));

                for (const field of fieldsData.fields) {
                  console.log(`   - ${field.name} (id: ${field.id}, type: ${field.type})`);
                }
              }
            }
          }
        }
      }
    }
  }

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMO DOS IDs ENCONTRADOS:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(results, null, 2));
  console.log('='.repeat(60));

  // Gerar código para o .env
  console.log('\n📝 Adicione ao seu .env:');
  console.log('---');
  console.log(`VITE_CLICKUP_TEAM_ID=${results.team_id || ''}`);
  console.log(`VITE_CLICKUP_SPACE_ID=${results.space_id || ''}`);
  console.log(`VITE_CLICKUP_FOLDER_ID=${results.folder_id || ''}`);
  console.log(`VITE_CLICKUP_LIST_ID=${results.list_id || ''}`);
  console.log('---');
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
