package dev.mkwhitelist.manager;

import javafx.application.Application;
import javafx.collections.transformation.FilteredList;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.layout.VBox;
import javafx.scene.control.cell.PropertyValueFactory;
import java.sql.PreparedStatement;
import javafx.scene.image.Image;


import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class App extends Application {

    private static final String DB_PATH = "C:/MinecraftTestServer/plugins/MKWhitelist/linked_accounts.db";

    @Override

    public void start(Stage primaryStage) {
        TableView<LinkedAccount> table = new TableView<>();

        TableColumn<LinkedAccount, String> uuidColumn = new TableColumn<>("Minecraft UUID");
        uuidColumn.setCellValueFactory(new PropertyValueFactory<>("minecraftUuid"));
        uuidColumn.setPrefWidth(250);


        TableColumn<LinkedAccount, String> discordColumn = new TableColumn<>("Discord ID");
        discordColumn.setCellValueFactory(new PropertyValueFactory<>("discordId"));
        discordColumn.setPrefWidth(200);

        table.getColumns().add(uuidColumn);
        table.getColumns().add(discordColumn);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);

        ObservableList<LinkedAccount> accounts = loadAccountsFromDatabase();
        FilteredList<LinkedAccount> filteredAccounts = new FilteredList<>(accounts, p -> true);
        table.setItems(filteredAccounts);

        TextField searchField = new TextField();
        searchField.setPromptText("Search by UUID or Discord ID...");

        searchField.textProperty().addListener((observable, oldValue, newValue) ->
        {
            filteredAccounts.setPredicate(account -> {
                if (newValue == null || newValue.isBlank()){
                    return true;
                }
                String lowerSearch = newValue.toLowerCase();
                return account.getMinecraftUuid().toLowerCase().contains(lowerSearch) || account.getDiscordId().toLowerCase().contains(lowerSearch);
            }
            );
        }
        );

        Button unlinkButton = new Button("Unlink Selected");
        unlinkButton.setOnAction(event -> { LinkedAccount selected = table.getSelectionModel().getSelectedItem();
            if (selected != null){
                unlinkAccount(selected, accounts);
            }
        }
        );

        Button refreshButton = new Button("Refresh");
        refreshButton.setOnAction(event -> { accounts.setAll(loadAccountsFromDatabase());
        }
        );

        HBox controls = new HBox(10, searchField, unlinkButton, refreshButton);
        VBox root = new VBox(10, controls, table);
        Scene scene = new Scene(root, 500, 400);

        primaryStage.setTitle("MKWhitelist Manager");
        primaryStage.setScene(scene);
        scene.getStylesheets().add(getClass().getResource("/dark-theme.css").toExternalForm());
        primaryStage.getIcons().add(new Image(getClass().getResourceAsStream("/icon.png")));
        primaryStage.show();
    }

    private ObservableList<LinkedAccount> loadAccountsFromDatabase() {
        ObservableList<LinkedAccount> accounts = FXCollections.observableArrayList();

        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
             Statement statement = connection.createStatement()) {
            ResultSet resultSet = statement.executeQuery("SELECT minecraft_uuid, discord_id FROM linked_accounts;");

            while(resultSet.next()){

                String uuid = resultSet.getString("minecraft_uuid");
                String discordId = resultSet.getString("discord_id");
                accounts.add(new LinkedAccount(uuid, discordId));

            }
        }   catch (Exception e) {
                System.err.println("Failed to load accounts: " + e.getMessage());
        }

        return accounts;
    }

    private void unlinkAccount(LinkedAccount account, ObservableList<LinkedAccount> accounts){
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
            PreparedStatement statement = connection.prepareStatement("DELETE FROM linked_accounts WHERE minecraft_uuid = ?;")){

            statement.setString(1, account.getMinecraftUuid());
            statement.executeUpdate();

            accounts.remove(account);
        }   catch (Exception e){
            System.err.println("Failed to unlink account: " + e.getMessage());
        }
    }

    public static void main(String[] args){
        launch(args);
    }
}
