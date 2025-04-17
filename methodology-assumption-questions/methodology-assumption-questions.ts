import { Component, Inject, Input, OnInit } from '@angular/core';
import { DataService } from 'src/app/shared/services/data.service';
import { FeatureFlagService } from 'src/app/shared/services/feature-flag.service';
import { Methodology } from 'src/app/shared/models/Methodology';
import { BlueModalRef, BlueModalService, BlueMultiselect, MultiselectOption } from '@moodys/blue-ng';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { JurisdictionDetail } from 'src/app/shared/models/regionJurisdictionDetails';
import { MethodologySensitivities } from '../../shared/models/MethodologySensitivities';
import { PRDisclosure } from 'src/app/shared/models/PRDisclosure';
import { KsaPopupModalComponent } from '../ksa-popup-modal/ksa-popup-modal.component';
import { combineLatest } from 'rxjs';
import { MethodologyService } from '../../shared/services/methodology.service';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-methodology-assumption-questions',
    templateUrl: './methodology-assumption-questions.component.html',
    styleUrls: ['./methodology-assumption-questions.component.scss']
})
export class MethodologyAssumptionQuestionsComponent implements OnInit {
    modalRef: BlueModalRef;
    private selectedRegion: JurisdictionDetail;
    selectedMethodologyQuestionsChoice = {};

    @Input() showRatingMethodologyFlag = false;
    @Input() selectedPrimaryMethodologyFromList: Methodology[] = [];
    @Input() primaryMethodologyRef: BlueMultiselect;
    @Input() prDisclosure: PRDisclosure;
    @Input() isRatingCommitteeMemo = false;

    manageMethodologySelectedOptions$ = combineLatest([
        this.methodologyService?.selectedMethodologies$,
        this.methodologyService.methodologiesBulkAction$
    ]).pipe(
        filter((respArray) => respArray[1] === false),
        tap((respArray) => {
            const methodologies = respArray[0];
            const methodologyArray = Object.keys(this.selectedMethodologyQuestionsChoice);
            if (methodologyArray.length) {
                const { selectedItems, allOptions } = methodologies;
                for (const methods of methodologyArray) {
                    const findMethod = selectedItems.find((value) => value.id === methods);
                    if (findMethod === undefined) {
                        const findInOptions = allOptions.find((value) => value.id === methods);
                        if (findInOptions && findInOptions['creditRatingUsed']) {
                            delete findInOptions['creditRatingUsed'];
                            this.dataService.getSelectedMethodologies().forEach((x) => (x.creditRatingUsed = null));
                        }
                        if (this.selectedMethodologyQuestionsChoice[methods]) {
                            delete this.selectedMethodologyQuestionsChoice[methods];
                            this.dataService.getSelectedMethodologies().forEach((x) => (x.creditRatingUsed = null));
                        }
                    }
                }
            }
        })
    );

    constructor(
        private dataService: DataService,
        private methodologyService: MethodologyService,
        public featureFlagService: FeatureFlagService,
        @Inject(BlueModalService) private modalService: BlueModalService,
        private translateService: TranslateService
    ) {}

    ngOnInit(): void {
        this.selectedRegion = this.dataService.getRegionJurisdiction();
        this.initializeMethodologyAssumptionMapping();
    }

    private initializeMethodologyAssumptionMapping() {
        this.selectedPrimaryMethodologyFromList = this.dataService.committeSupportWrapper.methodologies;
        this.selectedPrimaryMethodologyFromList.forEach((methodology) => {
            this.selectedMethodologyQuestionsChoice[methodology.id] = methodology.creditRatingUsed;
        });

        if (this.dataService.committeSupportWrapper?.moreInfoInPressRelease === YesNoUnknown.Yes) {
            this.prDisclosure.moreInfoThanSelectedMethodology =
                this.dataService.committeSupportWrapper.moreInfoInPressRelease === YesNoUnknown.Yes;
        }
        if (this.prDisclosure?.arabicTranslatedDomicileKSA) {
            this.prDisclosure.arabicTranslatedDomicileKSA =
                this.dataService.committeSupportWrapper.translationToArabic === YesNoUnknown.Yes;
        }
    }

    public isEnabledMethodologyDisclosure(selectedMethodology: MultiselectOption): boolean {
        const validPublication = this.getPublicationByRegion(selectedMethodology);
        return validPublication?.disclosure && !validPublication.isUserSelection;
    }

    updateMethodologyQuestionsToModel() {
        const methodologies = this.dataService.getSelectedMethodologies();
        if (methodologies) {
            methodologies.forEach((methodology) => {
                if (this.selectedMethodologyQuestionsChoice[methodology.id]) {
                    methodology.creditRatingUsed = this.selectedMethodologyQuestionsChoice[methodology.id];
                }
            });
        }
    }

    updateMethodologyAssumptionsToModel(selectedMethodology: any, selection: string) {
        const methodologies = this.dataService.getSelectedMethodologies();
        const validPublication = this.getPublicationByRegion(selectedMethodology);

        //New component logic. Remove else statement when flag is removed.
        if (selection === 'undefined') {
            delete validPublication['disclosure'];
            delete validPublication['isUserSelection'];
            delete methodologies.find(
                (selectedMethodologyService) => selectedMethodologyService.id === selectedMethodology.id
            ).disclosure;
        }
    }

    updateMoreInfoAndArabicTraslated() {
        this.dataService.committeSupportWrapper.moreInfoInPressRelease = this.prDisclosure
            ?.moreInfoThanSelectedMethodology
            ? YesNoUnknown.Yes
            : YesNoUnknown.No;

        const arabicTranslation = this.dataService.committeSupportWrapper.translationToArabic;

        if (
            this.isRatingCommitteeMemo &&
            this.prDisclosure.arabicTranslatedDomicileKSA &&
            (!arabicTranslation || arabicTranslation === YesNoUnknown.No)
        ) {
            this.modalRef = this.modalService.open(KsaPopupModalComponent, {
                title: this.translateService.instant('features.prDisclosure.KSApopup.title'),
                acceptLabel: this.translateService.instant('features.prDisclosure.ok')
            });
        }

        this.dataService.committeSupportWrapper.translationToArabic = this.prDisclosure.arabicTranslatedDomicileKSA
            ? YesNoUnknown.Yes
            : YesNoUnknown.No;
    }

    public getMethodologyDate(selectedMethodology: MultiselectOption) {
        return this.getPublicationByRegion(selectedMethodology)?.effectiveDate;
    }

    /*TODO EXTRACT INTO A PIPE*/
    public getPublicationByRegion(selectedMethodology: any) {
        const selectedJurisdiction = this.selectedRegion.jurisdiction;
        return selectedMethodology.publications.find(({ jurisdiction }) => {
            return jurisdiction === selectedJurisdiction;
        });
    }

    get yesNoUnknownOptions() {
        return YesNoUnknown;
    }
    get methodologyJurisdiction() {
        return this.selectedRegion.jurisdiction;
    }

    get allMethodologySensitivities() {
        return Object.values(MethodologySensitivities);
    }
}
