export const PATHS = {
  signIn: '/entrar',
  orgs: '/organizacoes',
  painel: '/painel',
  stock: '/stock',
  vendas: '/vendas',
  despesas: '/despesas',
  relatorios: '/relatorios',
  definicoes: '/definicoes',
} as const;

export const AUTO_ENTER_PARAM = 'auto';
export const ORGS_AFTER_SIGN_IN = `${PATHS.orgs}?${AUTO_ENTER_PARAM}=1`;
