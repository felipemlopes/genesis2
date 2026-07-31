import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/*', 'dist_test/*'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-extra-boolean-cast': 'off',
      // V6.5 (G01): formatPrice() já devolve o valor com "$ " prefixado — `${formatPrice(...)}`
      // dentro de uma template string que já começa com "$" literal produzia cifrão duplicado
      // ("$$ 65,370.93"), confirmado em 2 lugares de AnalysisResult.tsx.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "TemplateLiteral[quasis.0.value.raw='$'] CallExpression[callee.name='formatPrice']",
          message: 'formatPrice() já devolve "$ valor" — não prefixe com "$" de novo na template string.',
        },
      ],
    },
  },
];
