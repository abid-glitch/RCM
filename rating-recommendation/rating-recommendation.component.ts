import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WorklistService } from '../../services/worklist.service';
import { ContentLoaderService } from '../../services/content-loader.service';

@Component({
  selector: 'app-rating-recommendation',
  templateUrl: './rating-recommendation.component.html',
  styleUrls: ['./rating-recommendation.component.scss']
})
export class RatingRecommendationComponent implements OnInit {
  caseId: string;
  caseData: any;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private worklistService: WorklistService,
    private contentLoaderService: ContentLoaderService
  ) {}

  ngOnInit(): void {
    this.contentLoaderService.show();
    // Extract case ID from route parameters
    this.route.params.subscribe(params => {
      this.caseId = params['id']; // Make sure this matches your route parameter name
      console.log('[RatingRecommendation] Case ID from route:', this.caseId);
      
      if (this.caseId) {
        this.loadCaseData();
      } else {
        console.error('[RatingRecommendation] No case ID found in route');
        this.contentLoaderService.hide();
        this.loading = false;
      }
    });
  }

  loadCaseData(): void {
    console.log('[RatingRecommendation] Fetching case data for ID:', this.caseId);
    
    this.worklistService.getCaseById(this.caseId).subscribe({
      next: (data) => {
        console.log('[RatingRecommendation] Case data received:', data);
        this.caseData = data;
        this.loading = false;
        this.contentLoaderService.hide();
      },
      error: (error) => {
        console.error('[RatingRecommendation] Error fetching case data:', error);
        this.loading = false;
        this.contentLoaderService.hide();
      }
    });
  }
}
