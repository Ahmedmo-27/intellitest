import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DemoService } from '../../services/demo';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demo.html',
  styleUrl: './demo.css'
})
export class Demo {
  demoForm: FormGroup;
  generatedTestCases: any[] = [];
  testCodeScript: any = null;
  
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
