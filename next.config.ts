import type { NextConfig } from 'next';
const config: NextConfig = { outputFileTracingIncludes: {'/api/recommend': ['./data/model.json', './data/report.json']} };
export default config;
