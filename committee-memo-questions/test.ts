// Refined method to load country ceiling data
loadCountryCeilingData(): void {
    if (!this.caseId) return;

    this.committeePackageApiService
        .getCommitteePackage(this.caseId, this.numbercommittee)
        .pipe(
            takeUntil(this.destroy$),
            tap(response => {
                if (response && response.entity) {
                    const entityData = response.entity;
                    
                    if (entityData.organization) {
                        const domicile = entityData.organization.domicile;
                        const sovereign = entityData.organization.sovereign;
                        
                        if (domicile && sovereign) {
                            this.countryCode = domicile.code || '';
                            this.countryCeilings = this.getCountryCeilingTableData(sovereign, domicile);
                            // Force detection of changes after data is loaded
                            this._changeDetectorRef.detectChanges();
                        }
                    }
                }
            })
        )
        .subscribe({
            error: (error) => {
                console.error('Error loading committee package data:', error);
            }
        });
}

// Add this to ngOnInit to ensure numbercommittee is initialized
ngOnInit(): void {
    this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
    this.committeeInfo = this.committeeSupportWrapper.committeeMemoSetup;
    this.updateCreditModelQuestionDisplay();

    this.route.params
        .pipe(takeUntil(this.destroy$))
        .subscribe((params) => {
            if (params['caseId']) {
                this.caseId = params['caseId'];
                
                // Get committee number from route or data service
                this.numbercommittee = params['committeeNumber'] || 
                    this.dataService.getCommitteeNumber() || 
                    1; // Default to 1 if not available
                
                // Now load the data with both parameters properly set
                this.loadCountryCeilingData();
            }
        });

    // Keep the rest of your existing code
    this.initializeCountryCeilings();
    
    // Continue with existing code...
    this.updateCRQT$
        // ...existing code...
}

// Enhanced initialization of country ceilings as backup in case API call fails
initializeCountryCeilings(): void {
    const selectedEntities = this.dataService.getSelectedEntities();
    if (selectedEntities && selectedEntities.length > 0) {
        this.countryCeilings = this.getCountryCeiling(selectedEntities);
        if (this.countryCeilings && this.countryCeilings.length > 0) {
            this._changeDetectorRef.detectChanges();
        }
    } else {
        this.entityService.organizationFamily$
            .pipe(
                filter((family) => !!family),
                takeUntil(this.destroy$)
            )
            .subscribe((family) => {
                if (family) {
                    this.countryCeilings = this.getCountryCeiling([family]);
                    if (this.countryCeilings && this.countryCeilings.length > 0) {
                        this._changeDetectorRef.detectChanges();
                    }
                }
            });
    }
}
