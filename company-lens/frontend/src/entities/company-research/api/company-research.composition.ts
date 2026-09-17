import { createCompanyResearchApi } from './company-research.api';
import { runtimeConfig } from '../../../shared/config';
import { createCompanyResearchMockRepository } from './mock-company-research.repository';
import type { CompanyResearchRepository } from './company-research.repository';

let repository: CompanyResearchRepository | undefined;

export function getCompanyResearchRepository(): CompanyResearchRepository {
  repository ??=
    runtimeConfig.researchDataSource === 'mock'
      ? createCompanyResearchMockRepository()
      : createCompanyResearchApi();
  return repository;
}

export function setCompanyResearchRepositoryForTests(
  nextRepository: CompanyResearchRepository | undefined,
): void {
  repository = nextRepository;
}
