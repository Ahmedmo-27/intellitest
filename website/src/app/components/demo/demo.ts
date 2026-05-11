import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DemoService, ProjectGraphResponse, ProjectSummary } from '../../services/demo';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demo.html',
  styleUrl: './demo.css'
})
export class Demo implements OnInit {
  demoForm: FormGroup;
  generatedTestCases: any[] = [];
  testCodeScript: any = null;

  projects: ProjectSummary[] = [];
  selectedProjectId = '';
  projectGraph: ProjectGraphResponse | null = null;
  graphWeights: Array<{ name: string; weight: number; coverage: number | null }> = [];
  graphRelationships: Array<{ source: string; type: string; target: string; confidence: number | null }> = [];
  projectsLoading = false;
  graphLoading = false;
  graphError = '';
  
  isLoading = false;
  loadingMessage = '';
  errorMessage = '';

  constructor(private fb: FormBuilder, private demoService: DemoService) {
    this.demoForm = this.fb.group({
      language: ['', Validators.required],
      framework: ['', Validators.required],
      codeInput: ['', Validators.required],
      promptInput: ['', Validators.required],
    });
  }

  async ngOnInit() {
    await this.loadProjects();
  }

  showLoading(message: string) {
    this.isLoading = true;
    this.loadingMessage = message;
  }

  hideLoading() {
    this.isLoading = false;
  }

  showError(message: string) {
    this.errorMessage = message;
    this.generatedTestCases = [];
    this.testCodeScript = null;
  }

  clearResults() {
    this.generatedTestCases = [];
    this.testCodeScript = null;
    this.errorMessage = '';
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
      this.selectedProjectId = list.some(p => p.projectId === preferred) ? preferred : list[0].projectId;
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
      .map(row => ({
        source: row.source,
        type: row.type,
        target: row.target,
        confidence: typeof row.confidence === 'number' ? row.confidence : null,
      }))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 18);
  }

  async generateTestCases() {
    if (this.demoForm.invalid) {
      this.demoForm.markAllAsTouched();
      return;
    }

    this.clearResults();
    this.showLoading('Generating test cases...');

    const payload = {
      type: 'function',
      language: this.demoForm.value.language,
      framework: this.demoForm.value.framework,
      prompt: this.demoForm.value.promptInput,
      modules: [this.demoForm.value.codeInput],
    };

    try {
      this.generatedTestCases = await this.demoService.requestTestCases(payload);
    } catch (error: any) {
      this.showError(`Failed to generate test cases: ${error.message}`);
    } finally {
      this.hideLoading();
    }
  }

  async generateTestCode() {
    if (this.generatedTestCases.length === 0) {
      this.showError('Please generate test cases first.');
      return;
    }

    this.showLoading('Generating test code...');

    const payload = {
      type: 'function',
      language: this.demoForm.value.language,
      framework: this.demoForm.value.framework,
      prompt: this.demoForm.value.promptInput,
      modules: [this.demoForm.value.codeInput],
      testCases: this.generatedTestCases,
    };

    try {
      this.testCodeScript = await this.demoService.requestTestCode(payload);
    } catch (error: any) {
      this.showError(`Failed to generate test code: ${error.message}`);
    } finally {
      this.hideLoading();
    }
  }

  copyCode() {
    if (!this.testCodeScript?.code) return;
    navigator.clipboard.writeText(this.testCodeScript.code).catch(err => {
      this.showError('Failed to copy code to clipboard.');
    });
  }
}
