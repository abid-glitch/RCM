import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WorklistService } from '../../services/worklist.service';
import { ContentLoaderService } from '../../services/content-loader.service';
import { RatingRecommendationService } from '../services/rating-recommendation.service';
import { DataService } from '@shared/services/data.service';
import { take, finalize, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-rating-recommendation',
  templateUrl: './rating-recommendation.component.html',
  styleUrls: ['./rating-recommendation.component.scss']
})
export class RatingRecommendationComponent implements OnInit, OnDestroy {
  caseId: string;
  caseData: any;
  loading = true;
  private destroy$ = new Subject<void>();
  
  constructor(
    private route: ActivatedRoute,
    private worklistService: WorklistService,
    private contentLoaderService: ContentLoaderService,
    private ratingRecommendationService: RatingRecommendationService,
    private dataService: DataService
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
    
    // Subscribe to table loading state to manage the loading indicator
    this.ratingRecommendationService.tableDataIsLoadingState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loadingState => {
        console.log('[RatingRecommendation] Table loading state:', loadingState);
        // This will show/hide the loader based on the service's loading state
      });
  }
  
  loadCaseData(): void {
    console.log('[RatingRecommendation] Fetching case data for ID:', this.caseId);
    
    this.worklistService.getCaseById(this.caseId)
      .pipe(
        tap(caseData => {
          console.log('[RatingRecommendation] Case data received:', caseData);
          this.caseData = caseData;
          
          // Step 1: Store committee support data in the data service
          this.dataService.committeSupportWrapper = caseData;
          
          // Step 2: Ensure entities have all required properties
          if (caseData.entities?.length) {
            const processedEntities = caseData.entities.map(entity => ({
              ...entity,
              ratingClasses: entity.ratingClasses || [],
              debts: entity.debts || [],
              outlook: entity.outlook || null,
              hasRatingRecommendation: true
            }));
            
            // Step 3: Update data service with processed entities
            this.dataService.updateSelectedEntities(processedEntities);
            
            // Step 4: Set table mode in the rating recommendation service
            this.ratingRecommendationService.setRatingsTableMode({
              tableMode: 'EditRecommendation', // Use your actual enum value
              ratingsDetails: {} // Pass the appropriate dictionary if needed
            });
            
            // Step 5: Update entities subject in the service
            this.ratingRecommendationService.selectedEntitiesSubject.next(processedEntities);
            
            // Step 6: Initialize the default view
            this.ratingRecommendationService.determineDefaultView();
            
            // Step 7: Explicitly initialize the data stream
            this.ratingRecommendationService.initializeRatingRecommendationDataStream();
            
            console.log('[RatingRecommendation] Rating recommendation data stream initialized');
          } else {
            console.warn('[RatingRecommendation] No entities found in case data');
          }
        }),
        finalize(() => {
          // This will be called after the main data loading,
          // but the table might still be loading data
          this.loading = false;
        })
      )
      .subscribe({
        error: (error) => {
          console.error('[RatingRecommendation] Error fetching case data:', error);
          this.loading = false;
          this.contentLoaderService.hide();
        }
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
