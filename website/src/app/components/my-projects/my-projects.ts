import { Component, OnInit } from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DemoService, ProjectGraphResponse, ProjectSummary } from '../../services/demo';

@Component({
  selector: 'app-my-projects',
  standalone: true,
  imports: [CommonModule, NgIf, AsyncPipe],
  templateUrl: './my-projects.html',
  styleUrl: './my-projects.css'
})
export class MyProjects implements OnInit {
  projects: ProjectSummary[] = [];
  selectedProjectId = '';
  projectGraph: ProjectGraphResponse | null = null;
  graphWeights: Array<{ name: string; weight: number; coverage: number | null }> = [];
  graphRelationships: Array<{ source: string; type: string; target: string; confidence: number | null }> = [];
  projectsLoading = false;
  graphLoading = false;
  graphError = '';

  constructor(public auth: AuthService, private demoService: DemoService) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    this.projectsLoading = true;
    this.graphError = '';
    try {
      const list = await this.demoService.requestProjects();
      this.projects = list;
      if (list.length === 0) {
        this.selectedProjectId = '';
        this.projectGraph = null;
        this.graphWeights = [];
        this.graphRelationships = [];
        return;
      }
      const preferred = this.selectedProjectId || list[0].projectId;
      this.selectedProjectId = list.some((p) => p.projectId === preferred) ? preferred : list[0].projectId;
      await this.loadProjectGraph(this.selectedProjectId);
    } catch (error: any) {
      this.graphError = `Failed to load projects: ${error.message}`;
    } finally {
      this.projectsLoading = false;
    }
  }

  async loadProjectGraph(projectId: string) {
    if (!projectId) {
      return;
    }
    this.graphLoading = true;
    this.graphError = '';
    try {
      const graph = await this.demoService.requestProjectGraph(projectId);
      this.projectGraph = graph;
      this.buildGraphViews(graph);
    } catch (error: any) {
      this.graphError = `Failed to load project graph: ${error.message}`;
      this.projectGraph = null;
      this.graphWeights = [];
      this.graphRelationships = [];
    } finally {
      this.graphLoading = false;
    }
  }

  onProjectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const nextId = target?.value || '';
    this.selectedProjectId = nextId;
    void this.loadProjectGraph(nextId);
  }

  refreshProjects() {
    void this.loadProjects();
  }

  private buildGraphViews(graph: ProjectGraphResponse) {
    const weights = graph?.weights || {};
    this.graphWeights = Object.entries(weights)
      .map(([name, entry]) => ({
        name,
        weight: typeof entry?.weight === 'number' ? entry.weight : 0,
        coverage: typeof entry?.coverage === 'number' ? entry.coverage : null,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 12);

    const rels = Array.isArray(graph?.relationships) ? graph.relationships : [];
    this.graphRelationships = rels
      .map((row) => ({
        source: row.source,
        type: row.type,
        target: row.target,
        confidence: typeof row.confidence === 'number' ? row.confidence : null,
      }))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 18);
  }
}
