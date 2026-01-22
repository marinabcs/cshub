/**
 * Script para buscar IDs do ClickUp
 * Execute com: node scripts/fetch-clickup-ids.js
 *
 * Para buscar um workspace específico:
 * node scripts/fetch-clickup-ids.js --team=TEAM_ID
 */

const CLICKUP_API_KEY = 'pk_43150128_J7V5F0JC0VC3QQS1TJP2D53F5Q7TFKBE';
const BASE_URL = 'https://api.clickup.com/api/v2';

// Pegar argumento --team se fornecido
const args = process.argv.slice(2);
const teamArg = args.find(a => a.startsWith('--team='));
const SELECTED_TEAM_ID = teamArg ? teamArg.split('=')[1] : null;

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

  // 1. Buscar TODOS os Workspaces/Teams
  console.log('1️⃣ Buscando TODOS os workspaces...');
  const teamsData = await fetchClickUp('/team');

  console.log(`\n   📋 WORKSPACES ENCONTRADOS (${teamsData.teams?.length || 0}):`);
  console.log('   ' + '─'.repeat(50));

  if (teamsData.teams) {
    for (const team of teamsData.teams) {
      console.log(`   • ${team.name}`);
      console.log(`     ID: ${team.id}`);
      console.log(`     Membros: ${team.members?.length || 0}`);
      console.log('');
    }
  }

  // Selecionar team
  let selectedTeam = null;

  if (SELECTED_TEAM_ID) {
    selectedTeam = teamsData.teams.find(t => t.id === SELECTED_TEAM_ID);
    if (!selectedTeam) {
      console.log(`   ❌ Team ID ${SELECTED_TEAM_ID} não encontrado!`);
      return;
    }
  } else if (teamsData.teams?.length > 1) {
    console.log('   ⚠️  Múltiplos workspaces encontrados!');
    console.log('   Execute novamente com: node scripts/fetch-clickup-ids.js --team=TEAM_ID');
    console.log('');
    // Usar o primeiro por padrão
    selectedTeam = teamsData.teams[0];
    console.log(`   Usando primeiro workspace: ${selectedTeam.name} (${selectedTeam.id})`);
  } else if (teamsData.teams?.length === 1) {
    selectedTeam = teamsData.teams[0];
  }

  if (!selectedTeam) {
    console.log('   ❌ Nenhum workspace encontrado!');
    return;
  }

  console.log(`\n   ✅ Workspace selecionado: ${selectedTeam.name} (ID: ${selectedTeam.id})\n`);

  const results = {
    team_id: selectedTeam.id,
    team_name: selectedTeam.name,
    space_id: null,
    space_name: null,
    folder_id: null,
    folder_name: null,
    list_id: null,
    list_name: null,
    custom_fields: []
  };

  // 2. Buscar Spaces do workspace selecionado
  console.log('2️⃣ Buscando spaces...');
  const spacesData = await fetchClickUp(`/team/${selectedTeam.id}/space`);

  console.log(`\n   📋 SPACES ENCONTRADOS (${spacesData.spaces?.length || 0}):`);
  console.log('   ' + '─'.repeat(50));

  if (spacesData.spaces) {
    for (const space of spacesData.spaces) {
      console.log(`   • ${space.name}`);
      console.log(`     ID: ${space.id}`);
      console.log('');
    }

    // Usar o primeiro space
    const space = spacesData.spaces[0];
    results.space_id = space.id;
    results.space_name = space.name;
    console.log(`   ✅ Space selecionado: ${space.name} (ID: ${space.id})\n`);

    // 3. Buscar Folders do space
    console.log('3️⃣ Buscando folders...');
    const foldersData = await fetchClickUp(`/space/${space.id}/folder`);

    console.log(`\n   📋 FOLDERS ENCONTRADAS (${foldersData.folders?.length || 0}):`);
    console.log('   ' + '─'.repeat(50));

    if (foldersData.folders && foldersData.folders.length > 0) {
      for (const folder of foldersData.folders) {
        console.log(`   • ${folder.name}`);
        console.log(`     ID: ${folder.id}`);

        // Buscar lists dentro de cada folder
        const listsData = await fetchClickUp(`/folder/${folder.id}/list`);
        if (listsData.lists && listsData.lists.length > 0) {
          console.log(`     Lists:`);
          for (const list of listsData.lists) {
            console.log(`       - ${list.name} (ID: ${list.id})`);
          }
        }
        console.log('');
      }

      // Procurar folder "Atendimento" ou usar a primeira
      const atendimentoFolder = foldersData.folders.find(f =>
        f.name.toLowerCase().includes('atendimento')
      ) || foldersData.folders[0];

      results.folder_id = atendimentoFolder.id;
      results.folder_name = atendimentoFolder.name;

      // Buscar lists da folder selecionada
      const listsData = await fetchClickUp(`/folder/${atendimentoFolder.id}/list`);

      if (listsData.lists && listsData.lists.length > 0) {
        // Procurar list "Atividades" ou usar a primeira
        const atividadesList = listsData.lists.find(l =>
          l.name.toLowerCase().includes('atividades') || l.name.toLowerCase().includes('atividade')
        ) || listsData.lists[0];

        results.list_id = atividadesList.id;
        results.list_name = atividadesList.name;

        // Buscar campos customizados
        console.log('4️⃣ Buscando campos customizados...');
        const fieldsData = await fetchClickUp(`/list/${atividadesList.id}/field`);

        if (fieldsData.fields && fieldsData.fields.length > 0) {
          console.log(`\n   📋 CAMPOS CUSTOMIZADOS (${fieldsData.fields.length}):`);
          console.log('   ' + '─'.repeat(50));

          results.custom_fields = fieldsData.fields.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type
          }));

          for (const field of fieldsData.fields) {
            console.log(`   • ${field.name} (${field.type})`);
            console.log(`     ID: ${field.id}`);
          }
        }
      }
    } else {
      // Sem folders, buscar lists direto do space (folderless lists)
      console.log('   Nenhuma folder encontrada. Buscando lists sem folder...');
      const listsData = await fetchClickUp(`/space/${space.id}/list`);

      console.log(`\n   📋 LISTS SEM FOLDER (${listsData.lists?.length || 0}):`);
      console.log('   ' + '─'.repeat(50));

      if (listsData.lists && listsData.lists.length > 0) {
        for (const list of listsData.lists) {
          console.log(`   • ${list.name}`);
          console.log(`     ID: ${list.id}`);
          console.log('');
        }

        const selectedList = listsData.lists[0];
        results.list_id = selectedList.id;
        results.list_name = selectedList.name;
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
  console.log('─'.repeat(40));
  console.log(`VITE_CLICKUP_API_KEY=${CLICKUP_API_KEY}`);
  console.log(`VITE_CLICKUP_TEAM_ID=${results.team_id}`);
  console.log(`VITE_CLICKUP_SPACE_ID=${results.space_id || ''}`);
  console.log(`VITE_CLICKUP_FOLDER_ID=${results.folder_id || ''}`);
  console.log(`VITE_CLICKUP_LIST_ID=${results.list_id || ''}`);
  console.log('─'.repeat(40));
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
