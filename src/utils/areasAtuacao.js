export const AREAS_ATUACAO = [
  { value: 'aviacao', label: 'Aviação' },
  { value: 'telecomunicacoes', label: 'Telecomunicações' },
  { value: 'varejo', label: 'Varejo' },
  { value: 'educacao', label: 'Educação' },
  { value: 'saude', label: 'Saúde' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'industria', label: 'Indústria' },
  { value: 'governo', label: 'Governo' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'imobiliario', label: 'Imobiliário' },
  { value: 'outro', label: 'Outro' }
];

export function getAreaLabel(value) {
  return AREAS_ATUACAO.find(a => a.value === value)?.label || value || 'Não definida';
}
