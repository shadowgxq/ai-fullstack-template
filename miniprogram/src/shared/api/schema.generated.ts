// Generated from backend OpenAPI; do not edit.
export interface paths {
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_v1_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Me */
        get: operations["get_me_api_v1_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register */
        post: operations["register_api_v1_auth_register_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/wechat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Wechat Login */
        post: operations["wechat_login_api_v1_auth_wechat_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search Cities */
        get: operations["search_cities_api_v1_cities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/garments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Garments */
        get: operations["list_garments_api_v1_garments_get"];
        put?: never;
        /** Create Garment */
        post: operations["create_garment_api_v1_garments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/garments/{garment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Garment */
        get: operations["get_garment_api_v1_garments__garment_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Patch Garment */
        patch: operations["patch_garment_api_v1_garments__garment_id__patch"];
        trace?: never;
    };
    "/api/v1/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload Media */
        post: operations["upload_media_api_v1_media_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/media/{media_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Media */
        get: operations["download_media_api_v1_media__media_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Preferences */
        get: operations["get_preferences_api_v1_preferences_get"];
        /** Put Preferences */
        put: operations["put_preferences_api_v1_preferences_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Profile */
        get: operations["get_profile_api_v1_profile_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Patch Profile */
        patch: operations["patch_profile_api_v1_profile_patch"];
        trace?: never;
    };
    "/api/v1/recommendations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Recommendation */
        post: operations["create_recommendation_api_v1_recommendations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recommendations/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Recommendation */
        get: operations["get_recommendation_api_v1_recommendations__request_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recommendations/{request_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Recommendation */
        post: operations["cancel_recommendation_api_v1_recommendations__request_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recommendations/{request_id}/replacement-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Replacement Candidates */
        get: operations["replacement_candidates_api_v1_recommendations__request_id__replacement_candidates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recommendations/{request_id}/validate-selection": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate Selection */
        post: operations["validate_selection_api_v1_recommendations__request_id__validate_selection_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/statistics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Statistics */
        get: operations["get_statistics_api_v1_statistics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/wardrobe/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Options */
        get: operations["get_options_api_v1_wardrobe_options_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/wear-records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Wear Records */
        get: operations["list_wear_records_api_v1_wear_records_get"];
        put?: never;
        /** Create Wear Record */
        post: operations["create_wear_record_api_v1_wear_records_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/wear-records/{record_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Wear Record */
        get: operations["get_wear_record_api_v1_wear_records__record_id__get"];
        put?: never;
        post?: never;
        /** Delete Wear Record */
        delete: operations["delete_wear_record_api_v1_wear_records__record_id__delete"];
        options?: never;
        head?: never;
        /** Patch Wear Record */
        patch: operations["patch_wear_record_api_v1_wear_records__record_id__patch"];
        trace?: never;
    };
    "/api/v1/weather/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Weather Context */
        post: operations["create_weather_context_api_v1_weather_context_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health Check */
        get: operations["health_check_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness */
        get: operations["readiness_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** ApiResponse[CityList] */
        ApiResponse_CityList_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["CityList"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[CurrentUserResponse] */
        ApiResponse_CurrentUserResponse_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["CurrentUserResponse"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[GarmentCreated] */
        ApiResponse_GarmentCreated_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["GarmentCreated"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[GarmentDetail] */
        ApiResponse_GarmentDetail_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["GarmentDetail"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[GarmentList] */
        ApiResponse_GarmentList_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["GarmentList"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[GarmentView] */
        ApiResponse_GarmentView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["GarmentView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[list[ValidationIssue]] */
        ApiResponse_list_ValidationIssue__: {
            /**
             * Code
             * @default 0
             */
            code: number;
            /** Data */
            data?: components["schemas"]["ValidationIssue"][] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[MediaResponse] */
        ApiResponse_MediaResponse_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["MediaResponse"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[NoneType] */
        ApiResponse_NoneType_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            /** Data */
            data?: null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[PreferencesView] */
        ApiResponse_PreferencesView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["PreferencesView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[ProfileResponse] */
        ApiResponse_ProfileResponse_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["ProfileResponse"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[RecommendationCandidates] */
        ApiResponse_RecommendationCandidates_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["RecommendationCandidates"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[RecommendationSelection] */
        ApiResponse_RecommendationSelection_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["RecommendationSelection"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[RecommendationView] */
        ApiResponse_RecommendationView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["RecommendationView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[StatisticsView] */
        ApiResponse_StatisticsView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["StatisticsView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[TokenResponse] */
        ApiResponse_TokenResponse_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["TokenResponse"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WardrobeOptions] */
        ApiResponse_WardrobeOptions_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WardrobeOptions"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WearCreated] */
        ApiResponse_WearCreated_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WearCreated"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WearDeleted] */
        ApiResponse_WearDeleted_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WearDeleted"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WearList] */
        ApiResponse_WearList_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WearList"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WearView] */
        ApiResponse_WearView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WearView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WeatherContextView] */
        ApiResponse_WeatherContextView_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WeatherContextView"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** ApiResponse[WechatTokenResponse] */
        ApiResponse_WechatTokenResponse_: {
            /**
             * Code
             * @default 0
             */
            code: number;
            data?: components["schemas"]["WechatTokenResponse"] | null;
            /**
             * Message
             * @default success
             */
            message: string;
        };
        /** Body_upload_media_api_v1_media_post */
        Body_upload_media_api_v1_media_post: {
            /** File */
            file: string;
            /**
             * Purpose
             * @enum {string}
             */
            purpose: "garment" | "avatar";
        };
        /** CatalogOption */
        CatalogOption: {
            /** Id */
            id: string;
            /** Label */
            label: string;
        };
        /** CategoryCount */
        CategoryCount: {
            /** Category */
            category: string | null;
            /** Count */
            count: number;
        };
        /** CityList */
        CityList: {
            /** Items */
            items: components["schemas"]["RegionView"][];
            /** Mapping Version */
            mapping_version: string;
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CurrentUserResponse */
        CurrentUserResponse: {
            /** Id */
            id: number;
            /** Username */
            username: string;
        };
        /** DailyWearCount */
        DailyWearCount: {
            /** Count */
            count: number;
            /**
             * Date
             * Format: date
             */
            date: string;
        };
        /** FuzzyLocation */
        FuzzyLocation: {
            /**
             * Accuracy
             * @constant
             */
            accuracy: "fuzzy";
            /**
             * Coordinate System
             * @constant
             */
            coordinate_system: "gcj02";
            /** Latitude */
            latitude: number;
            /** Longitude */
            longitude: number;
        };
        /** GarmentCountsPage */
        GarmentCountsPage: {
            /** Items */
            items: components["schemas"]["GarmentWearCount"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** GarmentCreate */
        GarmentCreate: {
            /** Category */
            category?: string | null;
            /** Color */
            color?: string | null;
            /** Name */
            name?: string | null;
            /** Notes */
            notes?: string | null;
            /** Occasion */
            occasion?: string[];
            /** Photo Media Id */
            photo_media_id?: string | null;
            /** Season */
            season?: string[];
            /** Tags */
            tags?: string[];
        };
        /** GarmentCreated */
        GarmentCreated: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Version */
            version: number;
        };
        /** GarmentDetail */
        GarmentDetail: {
            /** Category */
            category?: string | null;
            /** Color */
            color?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name?: string | null;
            /** Notes */
            notes?: string | null;
            /** Occasion */
            occasion?: string[];
            /** Photo Media Id */
            photo_media_id?: string | null;
            /** Season */
            season?: string[];
            /**
             * Status
             * @enum {string}
             */
            status: "wearable" | "unavailable" | "archived";
            /** Tags */
            tags?: string[];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Version */
            version: number;
            /** Wear Count */
            wear_count: number;
        };
        /** GarmentList */
        GarmentList: {
            /** Items */
            items: components["schemas"]["GarmentView"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** GarmentPatch */
        GarmentPatch: {
            /** Category */
            category?: string | null;
            /** Color */
            color?: string | null;
            /** Expected Version */
            expected_version: number;
            /** Name */
            name?: string | null;
            /** Notes */
            notes?: string | null;
            /** Occasion */
            occasion?: string[];
            /** Photo Media Id */
            photo_media_id?: string | null;
            /** Season */
            season?: string[];
            /**
             * Status
             * @enum {string}
             */
            status?: "wearable" | "unavailable" | "archived";
            /** Tags */
            tags?: string[];
        };
        /** GarmentView */
        GarmentView: {
            /** Category */
            category?: string | null;
            /** Color */
            color?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name?: string | null;
            /** Notes */
            notes?: string | null;
            /** Occasion */
            occasion?: string[];
            /** Photo Media Id */
            photo_media_id?: string | null;
            /** Season */
            season?: string[];
            /**
             * Status
             * @enum {string}
             */
            status: "wearable" | "unavailable" | "archived";
            /** Tags */
            tags?: string[];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Version */
            version: number;
        };
        /** GarmentWearCount */
        GarmentWearCount: {
            /** Category */
            category: string | null;
            /**
             * Garment Id
             * Format: uuid
             */
            garment_id: string;
            /** Name */
            name: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "wearable" | "unavailable" | "archived";
            /** Wear Count */
            wear_count: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** LoginRequest */
        LoginRequest: {
            /** Password */
            password: string;
            /** Username */
            username: string;
        };
        /** MediaResponse */
        MediaResponse: {
            /** Content Type */
            content_type: string;
            /** Height */
            height: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Purpose
             * @enum {string}
             */
            purpose: "garment" | "avatar";
            /** Size Bytes */
            size_bytes: number;
            /**
             * Status
             * @constant
             */
            status: "ready";
            /** Width */
            width: number;
        };
        /** PreferencesPut */
        PreferencesPut: {
            /** Avoided Colors */
            avoided_colors: string[];
            /** Avoided Occasions */
            avoided_occasions: string[];
            /** Avoided Styles */
            avoided_styles: string[];
            /** Comfort Notes */
            comfort_notes: string | null;
            /** Expected Version */
            expected_version: number;
            /** Liked Colors */
            liked_colors: string[];
            /** Liked Occasions */
            liked_occasions: string[];
            /** Liked Styles */
            liked_styles: string[];
        };
        /** PreferencesView */
        PreferencesView: {
            /** Avoided Colors */
            avoided_colors: string[];
            /** Avoided Occasions */
            avoided_occasions: string[];
            /** Avoided Styles */
            avoided_styles: string[];
            /** Catalog Version */
            catalog_version: string;
            /** Comfort Notes */
            comfort_notes: string | null;
            /** Liked Colors */
            liked_colors: string[];
            /** Liked Occasions */
            liked_occasions: string[];
            /** Liked Styles */
            liked_styles: string[];
            /** Version */
            version: number;
        };
        /** ProfilePatch */
        ProfilePatch: {
            /** Avatar Media Id */
            avatar_media_id?: string | null;
            /** City Id */
            city_id?: string | null;
            /** Expected Version */
            expected_version: number;
            /** Nickname */
            nickname?: string | null;
        };
        /** ProfileResponse */
        ProfileResponse: {
            /** Avatar Media Id */
            avatar_media_id: string | null;
            /** City Id */
            city_id: string | null;
            /** Nickname */
            nickname: string | null;
            /** User Id */
            user_id: number;
            /** Version */
            version: number;
        };
        /** RecommendationCandidates */
        RecommendationCandidates: {
            /** Items */
            items: components["schemas"]["GarmentView"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** RecommendationCreate */
        RecommendationCreate: {
            /**
             * Scene
             * @default any
             * @enum {string}
             */
            scene: "any" | "work" | "daily" | "date";
            /** Weather Context Id */
            weather_context_id?: string | null;
        };
        /** RecommendationSelection */
        RecommendationSelection: {
            /** Garments */
            garments: components["schemas"]["GarmentView"][];
            /** Limitations */
            limitations: string[];
            /** Reasons */
            reasons: string[];
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            /** Selected Ids */
            selected_ids: string[];
        };
        /** RecommendationSelectionRequest */
        RecommendationSelectionRequest: {
            /** Selected Ids */
            selected_ids: string[];
        };
        /** RecommendationView */
        RecommendationView: {
            /** Candidate Scope Limited */
            candidate_scope_limited: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Deadline At
             * Format: date-time
             */
            deadline_at: string;
            /** Eligible Count */
            eligible_count: number;
            /** Error Code */
            error_code: string | null;
            /** Inventory Count */
            inventory_count: number;
            /** Limitations */
            limitations: string[];
            /** Outcome */
            outcome: ("recommendation" | "no_inventory" | "no_candidates") | null;
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            result: components["schemas"]["RecommendationSelection"] | null;
            /**
             * Scene
             * @enum {string}
             */
            scene: "any" | "work" | "daily" | "date";
            /**
             * Status
             * @enum {string}
             */
            status: "dispatch_pending" | "generating" | "ready" | "failed" | "cancelled" | "stale";
        };
        /** RegionView */
        RegionView: {
            /** City */
            city: string;
            /** City Id */
            city_id: string;
            /** Display Name */
            display_name: string;
            /** District */
            district: string;
            /** Mapping Version */
            mapping_version: string;
            /** Province */
            province: string;
            /** Region Id */
            region_id: string;
            /** Weather Code */
            weather_code: string;
        };
        /** RegisterRequest */
        RegisterRequest: {
            /** Password */
            password: string;
            /** Username */
            username: string;
        };
        /** StatisticsView */
        StatisticsView: {
            /** Archived Count */
            archived_count: number;
            /** Category Counts */
            category_counts: components["schemas"]["CategoryCount"][];
            garment_counts: components["schemas"]["GarmentCountsPage"];
            trend: components["schemas"]["WearTrend"];
            /** Unavailable Count */
            unavailable_count?: number | null;
            /** Wardrobe Total */
            wardrobe_total: number;
            /** Wear Record Count */
            wear_record_count: number;
            /** Wearable Count */
            wearable_count?: number | null;
        };
        /** TokenResponse */
        TokenResponse: {
            /** Access Token */
            access_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /** ValidationIssue */
        ValidationIssue: {
            /** Loc */
            loc: (string | number)[];
            /** Msg */
            msg: string;
            /** Type */
            type: string;
        };
        /** WardrobeOptions */
        WardrobeOptions: {
            /** Categories */
            categories: components["schemas"]["CatalogOption"][];
            /** Colors */
            colors: components["schemas"]["CatalogOption"][];
            /** Occasions */
            occasions: components["schemas"]["CatalogOption"][];
            /** Seasons */
            seasons: components["schemas"]["CatalogOption"][];
            /** Styles */
            styles: components["schemas"]["CatalogOption"][];
            /** Version */
            version: string;
        };
        /** WearCreate */
        WearCreate: {
            /** Garment Ids */
            garment_ids: string[];
            /** Recommendation Request Id */
            recommendation_request_id?: string | null;
            /**
             * Wear Date
             * Format: date
             */
            wear_date: string;
        };
        /** WearCreated */
        WearCreated: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Version */
            version: number;
        };
        /** WearDeleted */
        WearDeleted: {
            /**
             * Deleted
             * @default true
             * @constant
             */
            deleted: true;
            /**
             * Id
             * Format: uuid
             */
            id: string;
        };
        /** WearItem */
        WearItem: {
            /** Category Snapshot */
            category_snapshot: string | null;
            /**
             * Garment Id
             * Format: uuid
             */
            garment_id: string;
            /** Name Snapshot */
            name_snapshot: string | null;
        };
        /** WearList */
        WearList: {
            /** Items */
            items: components["schemas"]["WearView"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** WearPatch */
        WearPatch: {
            /** Expected Version */
            expected_version: number;
            /** Garment Ids */
            garment_ids?: string[];
            /**
             * Wear Date
             * Format: date
             */
            wear_date?: string;
        };
        /** WearTrend */
        WearTrend: {
            /** Days */
            days: components["schemas"]["DailyWearCount"][];
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /**
             * Timezone
             * @default Asia/Shanghai
             * @constant
             */
            timezone: "Asia/Shanghai";
        };
        /** WearView */
        WearView: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Items */
            items: components["schemas"]["WearItem"][];
            /** Recommendation Request Id */
            recommendation_request_id?: string | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Version */
            version: number;
            /**
             * Wear Date
             * Format: date
             */
            wear_date: string;
        };
        /** WeatherContextRequest */
        WeatherContextRequest: {
            /** City Id */
            city_id?: string | null;
            location?: components["schemas"]["FuzzyLocation"] | null;
        };
        /** WeatherContextView */
        WeatherContextView: {
            /**
             * Context Id
             * Format: uuid
             */
            context_id: string;
            facts: components["schemas"]["WeatherFacts"] | null;
            /** Missing Reason */
            missing_reason: ("upstream_unavailable" | "invalid_source" | "cache_busy" | "lock_lost" | "day_changed") | null;
            region: components["schemas"]["RegionView"];
            /**
             * Selection Source
             * @enum {string}
             */
            selection_source: "selected" | "saved" | "default" | "location";
            /**
             * State
             * @enum {string}
             */
            state: "available" | "missing";
            /**
             * Valid Until
             * Format: date-time
             */
            valid_until: string;
            /**
             * Weather Date
             * Format: date
             */
            weather_date: string;
        };
        /** WeatherFacts */
        WeatherFacts: {
            /**
             * Fetched At
             * Format: date-time
             */
            fetched_at: string;
            forecast: components["schemas"]["WeatherForecast"] | null;
            observation: components["schemas"]["WeatherObservation"] | null;
            /**
             * Parser Version
             * @constant
             */
            parser_version: "weather1d.v1";
            /**
             * Source
             * @constant
             */
            source: "weather.com.cn";
            /**
             * Valid Until
             * Format: date-time
             */
            valid_until: string;
        };
        /** WeatherForecast */
        WeatherForecast: {
            /** Day Summary */
            day_summary: string | null;
            /**
             * Forecast Date
             * Format: date
             */
            forecast_date: string;
            /** High C */
            high_c: number | null;
            /**
             * Issued At
             * Format: date-time
             */
            issued_at: string;
            /** Low C */
            low_c: number | null;
            /** Night Summary */
            night_summary: string | null;
        };
        /** WeatherObservation */
        WeatherObservation: {
            /**
             * Observed At
             * Format: date-time
             */
            observed_at: string;
            /** Temperature C */
            temperature_c: number;
        };
        /** WechatLoginRequest */
        WechatLoginRequest: {
            /** Code */
            code: string;
        };
        /** WechatTokenResponse */
        WechatTokenResponse: {
            /** Access Token */
            access_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
            user: components["schemas"]["CurrentUserResponse"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    login_api_v1_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_TokenResponse_"];
                };
            };
            /** @description Invalid or revoked credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Safe field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_list_ValidationIssue__"];
                };
            };
            /** @description Authentication dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
        };
    };
    logout_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Invalid or revoked credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Safe field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_list_ValidationIssue__"];
                };
            };
            /** @description Authentication dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
        };
    };
    get_me_api_v1_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_CurrentUserResponse_"];
                };
            };
            /** @description Invalid or revoked credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Safe field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_list_ValidationIssue__"];
                };
            };
            /** @description Authentication dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
        };
    };
    register_api_v1_auth_register_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_CurrentUserResponse_"];
                };
            };
            /** @description Invalid or revoked credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Safe field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_list_ValidationIssue__"];
                };
            };
            /** @description Authentication dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
        };
    };
    wechat_login_api_v1_auth_wechat_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WechatLoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WechatTokenResponse_"];
                };
            };
            /** @description Invalid or revoked credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
            /** @description Safe field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_list_ValidationIssue__"];
                };
            };
            /** @description Authentication dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_NoneType_"];
                };
            };
        };
    };
    search_cities_api_v1_cities_get: {
        parameters: {
            query: {
                cursor?: string | null;
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_CityList_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_garments_api_v1_garments_get: {
        parameters: {
            query?: {
                category?: string | null;
                color?: string | null;
                cursor?: string | null;
                occasion?: string | null;
                page_size?: number;
                season?: string | null;
                status?: ("wearable" | "unavailable" | "archived") | null;
                tag?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_GarmentList_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_garment_api_v1_garments_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GarmentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_GarmentCreated_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_garment_api_v1_garments__garment_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                garment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_GarmentDetail_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    patch_garment_api_v1_garments__garment_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                garment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GarmentPatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_GarmentView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_media_api_v1_media_post: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_media_api_v1_media_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_MediaResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    download_media_api_v1_media__media_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                media_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": unknown;
                    "image/png": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_preferences_api_v1_preferences_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_PreferencesView_"];
                };
            };
        };
    };
    put_preferences_api_v1_preferences_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreferencesPut"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_PreferencesView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_profile_api_v1_profile_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_ProfileResponse_"];
                };
            };
        };
    };
    patch_profile_api_v1_profile_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfilePatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_ProfileResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_recommendation_api_v1_recommendations_post: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecommendationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_RecommendationView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_recommendation_api_v1_recommendations__request_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_RecommendationView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_recommendation_api_v1_recommendations__request_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_RecommendationView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    replacement_candidates_api_v1_recommendations__request_id__replacement_candidates_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                exclude_ids?: string[] | null;
                page_size?: number;
            };
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_RecommendationCandidates_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    validate_selection_api_v1_recommendations__request_id__validate_selection_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecommendationSelectionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_RecommendationSelection_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_statistics_api_v1_statistics_get: {
        parameters: {
            query?: {
                garment_cursor?: string | null;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_StatisticsView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_options_api_v1_wardrobe_options_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WardrobeOptions_"];
                };
            };
        };
    };
    list_wear_records_api_v1_wear_records_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                end_date?: string | null;
                page_size?: number;
                start_date?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WearList_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_wear_record_api_v1_wear_records_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WearCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WearCreated_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_wear_record_api_v1_wear_records__record_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                record_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WearView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_wear_record_api_v1_wear_records__record_id__delete: {
        parameters: {
            query: {
                expected_version: number;
            };
            header?: never;
            path: {
                record_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WearDeleted_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    patch_wear_record_api_v1_wear_records__record_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                record_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WearPatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WearView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_weather_context_api_v1_weather_context_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WeatherContextRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiResponse_WeatherContextView_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_check_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    readiness_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Dependency unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
