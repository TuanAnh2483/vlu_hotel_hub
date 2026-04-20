package com.hotel.hotel_backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void catalogOptionsShouldBePublicAndReturnTypedSearchOptions() throws Exception {
        mockMvc.perform(get("/api/catalog/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.hotelTypes", hasItem("HOTEL")))
                .andExpect(jsonPath("$.data.hotelTypes", hasItem("RESORT")))
                .andExpect(jsonPath("$.data.roomCategories", hasItem("SUITE")))
                .andExpect(jsonPath("$.data.bedTypes", hasItem("TWIN")))
                .andExpect(jsonPath("$.data.hotelAmenities", hasItem("POOL")))
                .andExpect(jsonPath("$.data.roomAmenities", hasItem("BALCONY")));
    }
}
