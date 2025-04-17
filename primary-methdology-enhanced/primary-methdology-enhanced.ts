import { Component, EventEmitter, Inject, Input, Output } from '@angular/core';
import { PrimaryMethodologyService } from './services/primary-methodology.service';
import { Methodology } from '../../shared/models/Methodology';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { JurisdictionDetail } from '../../shared/models/regionJurisdictionDetails';
import { PRDisclosureCheckBoxActions, UpdateDisclosureParams } from './interfaces/methodology-assumptions.interface';
import { MethodologyCheckBoxOptionType } from './enums/enums';
import { KsaPopupModalComponent } from '../ksa-popup-modal/ksa-popup-modal.component';
import { BlueModalService } from '@moodys/blue-ng';
import { MethodologyFilterDetails } from './interfaces/enhanced-methodology.interface';
import { RFCImpactType } from './interfaces/rfc.interface';
import { MethodologyData } from '@app/close/repository/types/methodology-data';

@Component({
    selector: 'app-primary-methodology-enhanced',
    templateUrl: './primary-methodology-enhanced.component.html',
    styleUrls: ['./primary-methodology-enhanced.component.scss']
})
export class PrimaryMethodologyEnhancedComponent {
    readonly primaryMethodology$: Observable<MethodologyFilterDetails> =
        this.primaryMethodologyService.filteredMethodologyBySector$.pipe(
            map(([methodologyFilterDetails]) => methodologyFilterDetails)
        );

    readonly selectedSector$ = this.primaryMethodologyService.selectedSector$.pipe(
        tap((selectedSector) => this.selectedSector.emit(selectedSector))
    );
    readonly selectedSectorOption$ = this.primaryMethodologyService.selectedSectorOption$;

    readonly selectedMethodologies$ = this.primaryMethodologyService.selectedMethodology$;

    readonly selectedMethodologyValues$: Observable<Methodology[]> =
        this.primaryMethodologyService.selectedMethodology$.pipe(
            map((methodologiesMap) => {
                if (!methodologiesMap) {
                    return [];
                }

                return Array.from(methodologiesMap.values());
            }),
            tap((methodologies) => this.selectedMethodologies.emit(methodologies as MethodologyData[]))
        );
    selectedMethodologySectionIsValid = true;

    readonly prRDisclosure$ = this.primaryMethodologyService.prRDisclosure$;
    readonly selectedRatingGroup$ = this.primaryMethodologyService.selectedRatingGroup$;

    readonly methodologyJurisdiction$: Observable<JurisdictionDetail> =
        this.primaryMethodologyService.methodologyJurisdiction$;

    readonly showRfcSection$: Observable<boolean> = this.primaryMethodologyService.showRfcStatus$.pipe(
        tap((showRfcSection) => {
            this.rfcSectionIsValid = !showRfcSection;
        })
    );
    readonly selectedRfcImpactType$ = this.primaryMethodologyService.selectedRfcImpactType$;
    rfcSectionIsValid = true;

    @Input() isActionRequestFormSetup: boolean;
    @Input() showRequiredError: boolean;
    @Input() isRatingCommitteeClose = false;
    @Input() isRequired = false;

    @Output() sectionIsValid = new EventEmitter<boolean>();
    @Output() methodologyChanges = new EventEmitter<boolean>();
    @Output() selectedMethodologies = new EventEmitter<MethodologyData[]>();
    @Output() selectedSector = new EventEmitter<string>();

    constructor(
        private primaryMethodologyService: PrimaryMethodologyService,
        @Inject(BlueModalService) private modalService: BlueModalService
    ) {}

    onChangeSelectedSector(sector: string): void {
        this.primaryMethodologyService.setSelectedSector(sector);
    }

    addMethodology(methodology?: Methodology): void {
        if (methodology) {
            this.primaryMethodologyService.addSelectedMethodologyToList(methodology);
        }
        this.methodologyChanges.emit();
    }

    updateMethodologyDisclosure(updateDetails: UpdateDisclosureParams): void {
        this.primaryMethodologyService.updateMethodologyDisclosure(updateDetails);
    }

    setMethodologySectionValidityStatus(): void {
        const sectionIsValid = this.rfcSectionIsValid && this.selectedMethodologySectionIsValid;
        this.primaryMethodologyService.setSectionValidity(sectionIsValid);
        this.sectionIsValid.emit(sectionIsValid);
    }

    setSelectedImpactType(selectedImpactType: RFCImpactType) {
        this.primaryMethodologyService.manageSelectedImpactType(selectedImpactType);
    }

    manageMethodologyCheckBoxAction(prDisclosureCheckBoxActions: PRDisclosureCheckBoxActions): void {
        const { prDisclosure, actionType } = prDisclosureCheckBoxActions;
        if (
            actionType === MethodologyCheckBoxOptionType.ARABIC_TRANSLATED &&
            prDisclosure.arabicTranslatedDomicileKSA
        ) {
            this.showModal();
        }
        this.primaryMethodologyService.manageExternalPRDisclosureValues(prDisclosure);
    }

    showModal(): void {
        this.modalService.open(KsaPopupModalComponent, {
            title: 'features.prDisclosure.KSApopup.title',
            acceptLabel: 'features.prDisclosure.ok'
        });
    }
}
