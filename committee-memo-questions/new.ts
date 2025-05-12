/**
 * Loads country ceiling data for an organization
 * Uses a unified approach to get organization data from available sources
 */
loadCountryCeilingData(): void {
    // First try to get the case ID or extract it from URL if not available
    if (!this.caseId) {
        this.caseId = this.extractCaseIdFromUrl();
    }
    if (!this.caseId) {
        console.warn('No case ID available to load country ceiling data');
        return;
    }
    
    // Check if we already have selected entities from data service
    const selectedEntities = this.dataService.getSelectedEntities();
    if (selectedEntities && selectedEntities.length > 0) {
        this.processEntitiesForCountryCeiling(selectedEntities);
        return;
    }
    
    // Check if we can get data from organization family observable
    const organizationSub = this.entityService.organizationFamily$.pipe(
        filter(family => !!family),
        take(1),
        takeUntil(this.destroy$)
    ).subscribe(family => {
        if (family) {
            this.processEntitiesForCountryCeiling([family]);
        } else {
            // As a last resort, fetch from committee package API
            this.fetchFromCommitteePackage();
        }
    });
    
    // If the organization family observable doesn't emit quickly, unsubscribe
    setTimeout(() => {
        if (!organizationSub.closed) {
            organizationSub.unsubscribe();
            this.fetchFromCommitteePackage();
        }
    }, 500);
}

/**
 * Fetches data from committee package API as a fallback
 */
private fetchFromCommitteePackage(): void {
    this.committeePackageApiService.getCommitteePackage(this.caseId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
            next: response => {
                if (response?.entity?.organization) {
                    const organization = response.entity.organization;
                    this.processOrganizationForCountryCeiling(organization);
                }
            },
            error: err => console.error('Error fetching committee package:', err)
        });
}

/**
 * Process entities to extract organization data for country ceiling
 */
private processEntitiesForCountryCeiling(entities: any[]): void {
    if (!entities || entities.length === 0) {
        this.countryCeilings = [];
        return;
    }
    
    // Find organization in entities
    const org = entities.find((entity: any) => 
        entity.type === 'ORGANIZATION' || 
        (entity.organizations && entity.organizations.length > 0)
    );
    
    if (!org) {
        this.countryCeilings = [];
        return;
    }
    
    // Check if it's directly an organization or has organizations array
    const organization = org.type === 'ORGANIZATION' ? org : org.organizations?.[0];
    if (!organization) {
        this.countryCeilings = [];
        return;
    }
    
    this.processOrganizationForCountryCeiling(organization);
}

/**
 * Process a single organization object to extract country ceiling data
 */
private processOrganizationForCountryCeiling(organization: any): void {
    const domicile = organization.domicile;
    const sovereign = organization.sovereign;
    
    if (domicile) {
        this.countryCode = domicile.code || '';
    }
    
    this.countryCeilings = this.getCountryCeilingTableData(sovereign, domicile);
}

/**
 * Extract case ID from URL if not available in route params
 */
private extractCaseIdFromUrl(): string {
    const pathParts = window.location.pathname.split('/');
    const caseIdIndex = pathParts.findIndex(part => part === 'cases');
    if (caseIdIndex >= 0 && caseIdIndex < pathParts.length - 1) {
        return pathParts[caseIdIndex + 1];
    }
    return null;
}

/**
 * Format country ceiling table data
 */
private getCountryCeilingTableData(sovereign: any, domicile: any): BlueTableData {
    if (!sovereign || !domicile) return [];
    
    return [
        {
            data: {
                localSovereignRating: this.getRating(sovereign?.ratings || [], 'DOMESTIC'),
                foreignSovereignRating: this.getRating(sovereign?.ratings || [], 'FOREIGN'),
                localCountryCeiling: this.getRating(domicile?.ceilings || [], 'DOMESTIC'),
                foreignCountryCeiling: this.getRating(domicile?.ceilings || [], 'FOREIGN')
            }
        }
    ];
}

/**
 * Get rating by currency type
 */
private getRating(ratings: any[], currency: string): string {
    const rating = ratings.find((r: any) => r.currency === currency);
    return rating ? rating.value : '';
}
