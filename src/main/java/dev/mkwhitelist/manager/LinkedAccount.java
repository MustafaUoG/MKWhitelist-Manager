package dev.mkwhitelist.manager;

import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public class LinkedAccount {

    private final StringProperty minecraftUuid;
    private final StringProperty discordId;

    public LinkedAccount(String minecraftUuid, String discordId){
        this.minecraftUuid = new SimpleStringProperty(minecraftUuid);
        this.discordId = new SimpleStringProperty(discordId);
    }

    public String getMinecraftUuid(){
        return minecraftUuid.get();
    }

    public StringProperty minecraftUuidProperty(){
        return minecraftUuid;
    }

    public String getDiscordId(){
        return discordId.get();
    }

    public StringProperty discordIdProperty(){
        return discordId;
    }
}
