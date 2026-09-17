import { runtimeConfig, type DataSource } from '../../../shared/config';
import { apiResearchRepository } from './http/api-research.repository';
import { createMockResearchRepository } from './mock/mock-research.repository';
import type { ResearchRepository } from './research.repository';

export type ResearchCompositionOptions = {
  dataSource?: DataSource;
  repository?: ResearchRepository;
  apiRepository?: ResearchRepository;
  mockRepository?: ResearchRepository;
};

let composedRepository: ResearchRepository | undefined;
let testRepository: ResearchRepository | undefined;

export function createResearchRepository(
  options: ResearchCompositionOptions = {},
): ResearchRepository {
  if (options.repository) {
    return options.repository;
  }

  const source = options.dataSource ?? runtimeConfig.researchDataSource;
  if (source === 'api') {
    return options.apiRepository ?? apiResearchRepository;
  }
  return options.mockRepository ?? createMockResearchRepository();
}

export function getResearchRepository(): ResearchRepository {
  if (testRepository) {
    return testRepository;
  }
  composedRepository ??= createResearchRepository();
  return composedRepository;
}

/** 只供 model 测试替换完整 contract，生产入口不会按方法混用两个 data source。 */
export function setResearchRepositoryForTest(repository: ResearchRepository | undefined): void {
  testRepository = repository;
}

export function resetResearchComposition(): void {
  composedRepository = undefined;
  testRepository = undefined;
}
