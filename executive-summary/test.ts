// Add these properties to your component class
countryCode: string;
countryCeilings: BlueTableData = [];
isCountryCeilingsEnabled = true;

// Import BlueTableData type if not already imported
import { BlueTableData } from '@moodys/blue-ng';

// Add this method to your ngOnInit or where you initialize other data
initializeCountryCeilings(): void {
    this.countryCeilings = this.getCountryCeiling(this.entity);
}

// Add these helper methods to your component class
private getRating(ratings: any[], currency: string): string {
    const rating = ratings.find((r: any) => r.currency === currency);
    return rating ? rating.value : '';
}

private getCountryCeilingTableData(sovereign: any, domicile: any) {
    this.countryCode = domicile?.code;
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

private getCountryCeiling(entities: any[]) {
    const org = entities.find((entity: any) => entity.type === 'ORGANIZATION');
    const domicile = org?.domicile;
    const sovereign = org?.sovereign;
    return this.getCountryCeilingTableData(sovereign, domicile);
}
