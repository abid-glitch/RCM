updateCommitteePackage(
        committeePackageData: CommitteePackageData,
        numberOfCommittee: number,
        isAddRatingCommitteeReason: boolean,
        isVoterConfirmed: boolean,
        actionList: CommitteePackageActionListData[],
        publications: PublicationData[],
        isClose: boolean,
        files?: any[],
        actual?: string
    ) {
        if (actionList.length > 0) {
            delete committeePackageData.ratingCommittee.methodologies;
            delete committeePackageData.ratingCommittee.methodologySector;
        }
        const closeCommitteeData = {
            ratingCommittee: {
                ...committeePackageData.ratingCommittee,
                isAddRatingCommitteeReason,
                isVoterConfirmed,
                actual
            },
            teamSetups: committeePackageData.teamSetups,
            entityRatings: committeePackageData.entityRatings,
            packageDocuments: committeePackageData.packageDocuments,
            actionList,
            publications,
            ratingCommitteeNumber: Number(numberOfCommittee)
        };
        const formData = new FormData();
        files?.forEach((file) => {
            formData.append('files', file.file);
        });
        formData.append(
            'committeePackage',
            new Blob([JSON.stringify(closeCommitteeData)], { type: 'application/json' })
        );
        const url = isClose ? 'close-committee' : 'save';
        return this._httpClient.put<any>(
            `${this.appConfig.apiEndpoint}/${this.endPoint}/${committeePackageData.caseId}/rating-committee/${url}`,
            formData
        );
    }
